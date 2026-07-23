import sys
from http.server import SimpleHTTPRequestHandler, test

class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # 停用所有快取機制，確保瀏覽器每一次都會載入最新程式碼與樣式
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5500
    print(f"[Serving] Frontend static files on port {port} with caching disabled...")
    test(NoCacheHandler, port=port)
