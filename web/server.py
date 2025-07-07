import json
from http.server import SimpleHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs
import copy

BOARD_SIZE = 9

PIECE_NAMES = {
    'K': '\u738b',
    'R': '\u98db',
    'B': '\u89d2',
    'G': '\u91d1',
    'S': '\u9280',
    'N': '\u6842',
    'L': '\u9999',
    'P': '\u6b69'
}

PIECE_VALUES = {
    'K': 10000,
    'R': 500,
    'B': 400,
    'G': 300,
    'S': 250,
    'N': 200,
    'L': 150,
    'P': 100
}

START = [
    ['L','N','S','G','K','G','S','N','L'],
    [None,'R',None,None,None,None,None,'B',None],
    ['P']*9,
    [None]*9,
    [None]*9,
    [None]*9,
    ['p']*9,
    [None,'b',None,None,None,None,None,'r',None],
    ['l','n','s','g','k','g','s','n','l']
]

class Piece:
    def __init__(self, kind, owner):
        self.kind = kind.upper()
        self.owner = owner

    @property
    def text(self):
        return PIECE_NAMES[self.kind]

    @property
    def value(self):
        return PIECE_VALUES[self.kind]

class Game:
    def __init__(self):
        self.init_game()

    def init_game(self):
        self.board=[[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        for y in range(BOARD_SIZE):
            for x in range(BOARD_SIZE):
                val=START[y][x]
                if val:
                    owner=0 if val.isupper() else 1
                    self.board[y][x]=Piece(val.upper(), owner)
        self.hands={0:[],1:[]}
        self.turn=0
        self.history=[]

    def legal_moves(self,x,y):
        p=self.board[y][x]
        if not p:
            return []
        moves=[]
        dirs=[]
        if p.kind=='P':
            dirs=[(0,-1)] if p.owner==0 else [(0,1)]
        elif p.kind=='K':
            dirs=[(1,0),(-1,0),(0,1),(0,-1),(1,1),(1,-1),(-1,1),(-1,-1)]
        elif p.kind=='G':
            dirs=[(0,-1),(1,0),(-1,0),(0,1),(1,-1),(-1,-1)] if p.owner==0 else [(0,1),(1,0),(-1,0),(0,-1),(1,1),(-1,1)]
        elif p.kind=='S':
            dirs=[(0,-1),(1,-1),(-1,-1),(1,1),(-1,1)] if p.owner==0 else [(0,1),(1,1),(-1,1),(1,-1),(-1,-1)]
        for dx,dy in dirs:
            nx=x+dx if p.owner==0 else x-dx
            ny=y+dy if p.owner==0 else y-dy
            if 0<=nx<BOARD_SIZE and 0<=ny<BOARD_SIZE:
                dest=self.board[ny][nx]
                if not dest or dest.owner!=p.owner:
                    moves.append((nx,ny))
        return moves

    def move(self,src,dst):
        sx,sy=src
        dx,dy=dst
        piece=self.board[sy][sx]
        captured=self.board[dy][dx]
        self.board[dy][dx]=piece
        self.board[sy][sx]=None
        if captured:
            captured.owner=self.turn
            self.hands[self.turn].append(captured)
        self.history.append((src,dst,captured))

    def undo(self):
        if not self.history:
            return
        src,dst,cap=self.history.pop()
        piece=self.board[dst[1]][dst[0]]
        self.board[src[1]][src[0]]=piece
        self.board[dst[1]][dst[0]]=cap
        if cap:
            self.hands[self.turn].remove(cap)
            cap.owner=1-self.turn
        self.turn=1-self.turn

    def after_player(self):
        self.turn=1-self.turn
        if self.turn==1:
            self.ai_move()

    def ai_move(self):
        move=self.choose_ai_move()
        if move:
            self.move(*move)
        self.turn=0

    def choose_ai_move(self):
        moves=[]
        for y in range(BOARD_SIZE):
            for x in range(BOARD_SIZE):
                p=self.board[y][x]
                if p and p.owner==1:
                    for dst in self.legal_moves(x,y):
                        moves.append(((x,y),dst))
        best=None
        best_score=None
        for move in moves:
            bcopy=copy.deepcopy(self.board)
            hcopy=copy.deepcopy(self.hands)
            sx,sy=move[0]
            dx,dy=move[1]
            piece=bcopy[sy][sx]
            captured=bcopy[dy][dx]
            bcopy[dy][dx]=piece
            bcopy[sy][sx]=None
            if captured:
                captured.owner=1
                hcopy[1].append(captured)
            score=self.evaluate(bcopy,hcopy)
            if best_score is None or score<best_score:
                best_score=score
                best=move
        return best

    def evaluate(self,b,h):
        s=0
        for y in range(BOARD_SIZE):
            for x in range(BOARD_SIZE):
                p=b[y][x]
                if p:
                    val=p.value
                    s+=val if p.owner==0 else -val
        for p in h[0]:
            s+=p.value
        for p in h[1]:
            s-=p.value
        return s

    def state(self):
        board=[[{'k':p.kind,'o':p.owner} if p else None for p in row] for row in self.board]
        hands={0:[{'k':p.kind} for p in self.hands[0]],1:[{'k':p.kind} for p in self.hands[1]]}
        return {'board':board,'hands':hands,'turn':self.turn}

game=Game()

class Handler(SimpleHTTPRequestHandler):
    def _json(self,obj):
        data=json.dumps(obj).encode()
        self.send_response(200)
        self.send_header('Content-Type','application/json')
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        url=urlparse(self.path)
        if url.path=="/state":
            self._json(game.state())
        elif url.path=="/moves":
            qs=parse_qs(url.query)
            x=int(qs.get('x',[0])[0])
            y=int(qs.get('y',[0])[0])
            self._json(game.legal_moves(x,y))
        else:
            if self.path=="/":
                self.path="/templates/index.html"
            return super().do_GET()

    def do_POST(self):
        length=int(self.headers.get('Content-Length',0))
        data=self.rfile.read(length)
        payload=json.loads(data)
        if self.path=="/move":
            src=tuple(payload['from'])
            dst=tuple(payload['to'])
            game.move(src,dst)
            game.after_player()
            self._json(game.state())
        elif self.path=="/undo":
            game.undo()
            self._json(game.state())
        else:
            self.send_error(404)

if __name__=='__main__':
    server=HTTPServer(('0.0.0.0',8000),Handler)
    print('Serving on port 8000')
    server.serve_forever()
