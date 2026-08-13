import subprocess

def execute(task):

    tool = task["tool"]
    app = task["application"]

    if tool == "deploy":

        if app == "react":

            subprocess.run(
                ["bash", "scripts/deploy_react.sh"]
            )

        elif app == "java":

            subprocess.run(
                ["bash", "scripts/deploy_java.sh"]
            )

    else:

        print("Unknown tool")
