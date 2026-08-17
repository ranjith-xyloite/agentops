import pytest
from app.schemas import ToolRequest, WorkflowStep
from app.services.task_service import task_service


@pytest.mark.asyncio
async def test_multi_step_dag_execution_success(mock_ssh_executor):
    steps = [
        WorkflowStep(tool="server_health_check", parameters={"environment": "uat"}, description="Pre-check"),
        WorkflowStep(tool="docker_status", parameters={"environment": "uat"}, description="Docker inspection")
    ]
    parsed = ToolRequest(
        tool="deploy_backend",
        requires_confirmation=False,
        steps=steps
    )
    task = await task_service.create_task("Run safe pipeline", parsed)
    assert task.workflow_dag is not None
    assert len(task.workflow_dag) == 2

    await task_service.execute_workflow_dag(task.id, steps)
    updated = await task_service.get_task(task.id)
    assert updated.status == "SUCCESS"


@pytest.mark.asyncio
async def test_multi_step_dag_auto_rollback_on_failure(mock_ssh_executor):
    # Step 1 succeeds, Step 2 fails with unknown tool -> triggers rollback of Step 1
    steps = [
        WorkflowStep(
            tool="server_health_check",
            parameters={"environment": "uat"},
            description="Step 1",
            rollback_tool="restart_container",
            rollback_parameters={"container_name": "backup-container"}
        ),
        WorkflowStep(
            tool="invalid_nonexistent_tool_xyz",
            parameters={},
            description="Step 2"
        )
    ]
    parsed = ToolRequest(
        tool="deploy_backend",
        requires_confirmation=False,
        steps=steps
    )
    task = await task_service.create_task("Run failing pipeline", parsed)
    await task_service.execute_workflow_dag(task.id, steps)

    updated = await task_service.get_task(task.id)
    assert updated.status == "ROLLED_BACK"
    assert "Workflow failed and rolled back" in updated.last_message
