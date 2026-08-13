from planner import plan
from executor import execute

query = input("You: ")

task = plan(query)

print("\nAI Plan:")
print(task)

execute(task)
