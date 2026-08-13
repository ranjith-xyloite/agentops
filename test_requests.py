import requests

url = "http://127.0.0.1:11434/api/chat"

payload = {
    "model": "qwen3:4b",
    "messages": [
        {
            "role": "user",
            "content": "Say hello"
        }
    ],
    "stream": False
}

response = requests.post(url, json=payload)

print(response.status_code)
print(response.text)
