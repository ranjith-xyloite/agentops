import ollama

print("Testing connection...")

response = ollama.chat(
    model="qwen3:4b",
    messages=[
        {
            "role": "user",
            "content": "Say hello"
        }
    ]
)

print(response["message"]["content"])
