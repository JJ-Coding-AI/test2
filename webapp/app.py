import http.server
import socketserver
import json
import random
import os

PORT = 8000

WORDS = [
    {"word": "abandon", "meaning": "\u653e\u68c4\u3059\u308b"},
    {"word": "benefit", "meaning": "\u5229\u76ca"},
    {"word": "candidate", "meaning": "\u5bfe\u8a71\u8005\uff1b\u5019\u88dc"},
    {"word": "debate", "meaning": "\u8a55\u8ad6\uff1b\u8ad6\u4e89"},
    {"word": "efficient", "meaning": "\u52b9\u7387\u7684\u306a"},
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
