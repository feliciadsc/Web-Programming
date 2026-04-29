import socket 
import os
import gzip
import threading
import json

def handle_client(clientsocket, address):
    print(f'S-a conectat un client: {address}')
    
    date_primite = b""
    while True:
        data = clientsocket.recv(1024)
        if not data: break
        date_primite += data
        if b"\r\n\r\n" in date_primite: 
            break
            
    try:
        header_text = date_primite.decode('utf-8')
        linieDeStart = header_text.split('\r\n')[0]
        elemente = linieDeStart.split()
        metoda = elemente[0] if len(elemente) > 0 else "GET"
        numeResursa = elemente[1] if len(elemente) > 1 else "/index.html"
    except:
        clientsocket.close()
        return

    if metoda == "POST" and numeResursa == "/api/utilizatori":
        content_length = 0
        for linie in header_text.split('\r\n'):
            if "Content-Length:" in linie:
                content_length = int(linie.split(":")[1].strip())
        
        corp_cerere = date_primite.split(b"\r\n\r\n")[1]
        while len(corp_cerere) < content_length:
            corp_cerere += clientsocket.recv(1024)
            
        try:
            nou_utilizator = json.loads(corp_cerere.decode('utf-8'))
            cale_json = os.path.join("..", "continut", "resurse", "utilizatori.json")
            
            utilizatori = []
            if os.path.exists(cale_json):
                with open(cale_json, 'r') as f:
                    utilizatori = json.load(f)
            
            utilizatori.append(nou_utilizator)
            
            with open(cale_json, 'w') as f:
                json.dump(utilizatori, f, indent=2)
                
            status_linie = "HTTP/1.1 200 OK\r\n"
            raspuns_text = json.dumps({"status": "succes"}).encode('utf-8')
        except Exception as e:
            print(f"Eroare la procesare POST: {e}")
            status_linie = "HTTP/1.1 500 Internal Server Error\r\n"
            raspuns_text = b"Eroare la salvarea datelor."
            
        clientsocket.sendall(status_linie.encode('utf-8'))
        clientsocket.sendall(b"Content-Type: application/json\r\n\r\n")
        clientsocket.sendall(raspuns_text)

    else:
        if numeResursa == '/': numeResursa = '/index.html'
        caleFisier = os.path.join("..", "continut", numeResursa.lstrip('/'))
        
        if os.path.isfile(caleFisier):
            with open(caleFisier, 'rb') as f:
                continut_fisier = f.read()
            status_linie = "HTTP/1.1 200 OK\r\n"
            
            if numeResursa.endswith(".html"): content_type = "text/html"
            elif numeResursa.endswith(".css"): content_type = "text/css"
            elif numeResursa.endswith(".js"): content_type = "application/js"
            elif numeResursa.endswith(".json"): content_type = "application/json"
            elif numeResursa.endswith(".png"): content_type = "text/png"
            elif numeResursa.endswith(".gif"): content_type = "text/gif"
            elif numeResursa.endswith(".jpeg"): content_type = "text/jpeg"
            elif numeResursa.endswith(".ico"): content_type = "image/x-icon"
            else: content_type = "text/plain"
            
            raspuns = gzip.compress(continut_fisier)
            content_encoding = "Content-Encoding: gzip\r\n"
        else:
            status_linie = "HTTP/1.1 404 Not Found\r\n"
            raspuns = gzip.compress(f"Resursa {numeResursa} nu exista".encode('utf-8'))
            content_encoding = "Content-Encoding: gzip\r\n"
            content_type = "text/plain"

        raspuns_http = status_linie 
        raspuns_http += f"Content-Length: {len(raspuns)}\r\n"
        raspuns_http += f"Content-Type: {content_type}; charset=utf-8\r\n"
        raspuns_http += content_encoding
        raspuns_http += "Server: Serverul_Educatie\r\nConnection: close\r\n\r\n"
        
        clientsocket.sendall(raspuns_http.encode('utf-8'))
        clientsocket.sendall(raspuns)
    
    clientsocket.close()

serversocket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
serversocket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
serversocket.bind(('', 5678)) 
serversocket.listen(5)
print('Serverul asculta pe portul 5678...')

while True:
    (clientsocket, address) = serversocket.accept()
    threading.Thread(target=handle_client, args=(clientsocket, address)).start()