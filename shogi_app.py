
import tkinter as tk
import copy

BOARD_SIZE = 9
CELL = 60

PIECE_NAMES = {
    'K': '王',
    'R': '飛',
    'B': '角',
    'G': '金',
    'S': '銀',
    'N': '桂',
    'L': '香',
    'P': '歩'
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
    def __init__(self, root):
        self.root = root
        self.canvas = tk.Canvas(root, width=CELL*BOARD_SIZE+150, height=CELL*BOARD_SIZE)
        self.canvas.pack()
        self.status = tk.Label(root, text='')
        self.status.pack()
        self.btn = tk.Button(root, text='待った', command=self.undo)
        self.btn.pack()
        self.init_game()
        self.canvas.bind('<ButtonPress-1>', self.press)
        self.canvas.bind('<B1-Motion>', self.drag)
        self.canvas.bind('<ButtonRelease-1>', self.release)
        self.drag_item=None
        self.drag_from=None
        self.drag_piece=None
        self.highlights=[]

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
        self.draw()
        self.update_status()

    def draw(self):
        self.canvas.delete('all')
        for y in range(BOARD_SIZE):
            for x in range(BOARD_SIZE):
                x1=x*CELL
                y1=y*CELL
                self.canvas.create_rectangle(x1,y1,x1+CELL,y1+CELL,fill='bisque')
                piece=self.board[y][x]
                if piece:
                    angle=0 if piece.owner==0 else 180
                    self.canvas.create_text(x1+CELL/2,y1+CELL/2,text=piece.text,font=('Helvetica',20),angle=angle)
        off=BOARD_SIZE*CELL+20
        self.canvas.create_text(off,20,text='先手持ち駒')
        for i,p in enumerate(self.hands[0]):
            self.canvas.create_text(off,40+i*20,text=p.text)
        self.canvas.create_text(off,CELL*BOARD_SIZE-20,text='後手持ち駒')
        for i,p in enumerate(self.hands[1]):
            self.canvas.create_text(off,CELL*BOARD_SIZE-40-i*20,text=p.text)

    def update_status(self):
        self.status['text']='先手番' if self.turn==0 else '後手番'

    def press(self,event):
        x=event.x//CELL
        y=event.y//CELL
        if x>=BOARD_SIZE:
            return
        p=self.board[y][x]
        if p and p.owner==self.turn:
            self.drag_piece=p
            self.drag_from=(x,y)
            self.drag_item=self.canvas.create_text(event.x,event.y,text=p.text,font=('Helvetica',20))
            self.show_moves(x,y)

    def drag(self,event):
        if self.drag_item:
            self.canvas.coords(self.drag_item,event.x,event.y)

    def release(self,event):
        if not self.drag_piece:
            return
        x=event.x//CELL
        y=event.y//CELL
        moves=self.legal_moves(self.drag_from[0],self.drag_from[1])
        if (x,y) in moves:
            self.move(self.drag_from,(x,y))
            self.after_player()
        self.canvas.delete(self.drag_item)
        self.drag_item=None
        self.drag_piece=None
        self.drag_from=None
        self.clear_high()

    def clear_high(self):
        for h in self.highlights:
            self.canvas.delete(h)
        self.highlights=[]

    def show_moves(self,x,y):
        self.clear_high()
        for mx,my in self.legal_moves(x,y):
            r=self.canvas.create_rectangle(mx*CELL,my*CELL,(mx+1)*CELL,(my+1)*CELL,outline='red',width=2)
            self.highlights.append(r)

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
        self.draw()
        self.update_status()

    def after_player(self):
        self.draw()
        self.turn=1-self.turn
        self.update_status()
        if self.turn==1:
            self.root.after(200,self.ai_move)

    def ai_move(self):
        self.status['text']='考え中...'
        self.root.update()
        move=self.choose_ai_move()
        if move:
            self.move(*move)
        self.turn=0
        self.draw()
        self.update_status()

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

def main():
    root=tk.Tk()
    root.title('簡易将棋')
    Game(root)
    root.mainloop()

if __name__=='__main__':
    main()
