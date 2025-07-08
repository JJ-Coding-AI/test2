"""FastAPI ベースの将棋 AI サーバー"""
import json
import asyncio
import subprocess
from pathlib import Path

import shogi
from fastapi import FastAPI, WebSocket

app = FastAPI()

ENGINE_PATH = Path('./yaneuraou')
NNUE_PATH = Path('eval/SuishoKai-NNUE.bin')


class YaneuraOu:
    """YaneuraOu USI エンジンラッパー"""

    def __init__(self, path: Path, depth: int = 8, threads: int = 2):
        self.path = path
        self.depth = depth
        self.threads = threads
        self.proc = subprocess.Popen(
            [str(self.path)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            text=True,
            bufsize=1,
        )
        self._send('usi')
        self._wait_ready()
        self.set_option('Threads', str(self.threads))
        self.set_option('USI_Ponder', 'false')
        self.set_option('EvalDir', str(NNUE_PATH.parent))
        self.set_option('EvalFile', str(NNUE_PATH))
        self._send('isready')
        self._wait_ready()
        self._send('usinewgame')

    def set_option(self, name: str, value: str):
        self._send(f'setoption name {name} value {value}')

    def _send(self, cmd: str):
        assert self.proc.stdin
        self.proc.stdin.write(cmd + '\n')
        self.proc.stdin.flush()

    def _readline(self) -> str:
        assert self.proc.stdout
        return self.proc.stdout.readline().strip()

    def _wait_ready(self):
        while True:
            line = self._readline()
            if line == 'readyok':
                break

    async def think(self, board: shogi.Board) -> str:
        """bestmove を取得する"""
        self._send('position sfen ' + board.sfen())
        self._send(f'go depth {self.depth}')
        while True:
            line = self._readline()
            if line.startswith('bestmove'):
                return line.split()[1]


def build_state(board: shogi.Board):
    """盤面情報を辞書にして返す"""
    state = {
        'turn': 'sente' if board.turn == shogi.BLACK else 'gote',
        'board': {},
        'hands': {'sente': [], 'gote': []},
        'legal_moves': {},
    }
    for sq in shogi.SQUARES:
        piece = board.piece_at(sq)
        if piece:
            file = 9 - shogi.square_file(sq)
            rank = shogi.square_rank(sq) + 1
            state['board'][f'{file}{rank}'] = piece.symbol()
    for m in board.legal_moves:
        fr, to = m.usi()[:2], m.usi()[2:4]
        state['legal_moves'].setdefault(fr, []).append(to)
    for color, hand in [('sente', board.pieces_in_hand[shogi.BLACK]),
                        ('gote', board.pieces_in_hand[shogi.WHITE])]:
        for p in hand:
            state['hands'][color].append(shogi.PIECE_SYMBOLS[p].upper())
    return state


class GameSession:
    """1接続分のゲーム状態"""

    def __init__(self):
        self.board = shogi.Board()
        self.history: list[str] = []
        self.engine = YaneuraOu(ENGINE_PATH)

    async def move(self, move_usi: str):
        self.board.push_usi(move_usi)
        self.history.append(move_usi)
        if self.board.is_checkmate() or self.board.is_game_over():
            self.board = shogi.Board()
            self.history.clear()
            return
        best = await self.engine.think(self.board)
        self.board.push_usi(best)
        self.history.append(best)
        if self.board.is_checkmate() or self.board.is_game_over():
            self.board = shogi.Board()
            self.history.clear()

    def undo(self):
        if len(self.history) >= 2:
            self.board.pop()
            self.board.pop()
            self.history = self.history[:-2]

    def kif(self) -> str:
        return '\n'.join(self.history)


@app.websocket('/ws')
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    session = GameSession()
    await ws.send_json({'type': 'state', 'state': build_state(session.board)})
    try:
        while True:
            data = json.loads(await ws.receive_text())
            if data['type'] == 'move':
                move = data['from'] + data['to']
                await session.move(move)
                await ws.send_json({'type': 'state', 'state': build_state(session.board)})
            elif data['type'] == 'undo':
                session.undo()
                await ws.send_json({'type': 'state', 'state': build_state(session.board)})
            elif data['type'] == 'kif':
                await ws.send_json({'type': 'kif', 'kif': session.kif()})
            elif data['type'] == 'level':
                level = data['level']
                if level == 'weak':
                    session.engine.depth = 4
                    session.engine.set_option('Threads', '1')
                elif level == 'normal':
                    session.engine.depth = 8
                    session.engine.set_option('Threads', '2')
                else:
                    session.engine.depth = 16
                    session.engine.set_option('Threads', '4')
    except Exception:
        pass
