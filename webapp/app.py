import http.server
import socketserver
import json
import random
import os

PORT = 8000

WORDS = [
    {"word": "挨拶", "meaning": "greeting"},
    {"word": "経済", "meaning": "economy"},
    {"word": "文化", "meaning": "culture"},
    {"word": "教育", "meaning": "education"},
    {"word": "技術", "meaning": "technology"},
    {"word": "研究", "meaning": "research"},
    {"word": "旅行", "meaning": "travel"},
    {"word": "健康", "meaning": "health"},
    {"word": "社会", "meaning": "society"},
    {"word": "環境", "meaning": "environment"},
]

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/word':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(random.choice(WORDS)).encode('utf-8'))
        else:
            if self.path == '/':
                self.path = '/static/index.html'
            elif not self.path.startswith('/static/'):
                self.path = '/static' + self.path
            return http.server.SimpleHTTPRequestHandler.do_GET(self)

if __name__ == '__main__':
    os.chdir(os.path.dirname(__file__))
    with socketserver.TCPServer(('', PORT), Handler) as httpd:
        print(f"Serving on http://localhost:{PORT}")
        httpd.serve_forever()
