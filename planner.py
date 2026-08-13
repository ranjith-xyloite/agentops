import json
import ollama

MODEL = "qwen3:4b"

SYSTEM_PROMPT = """
You are an AI DevOps planner.

Return ONLY valid JSON.

Available tools:

deploy
restart
rollback
logs
status
health

Applications:

react
java

Environments:

dev
qa
prod

Example:

{
    "tool":"deploy",
    "application":"react",
    "environment":"dev"
}
"""

def plan(query):

    response = ollama.chat(
        model=MODEL,
        messages=[
            {
                "role":"system",
                "content":SYSTEM_PROMPT
            },
            {
                "role":"user",
                "content":query
            }
        ]
    )

    return json.loads(response["message"]["content"])
