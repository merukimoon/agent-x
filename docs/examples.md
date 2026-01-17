# Examples

## Run example: Flow A (PR completion)

- Reference: `docs/run-examples/pr-completion/README.md`
- Purpose: shows the golden path for manual execution of Flow A using the run layout and Agent Contract outputs.

These code-oriented examples remain minimal and may be pseudo-code until the framework API is implemented (**TODO**).

## Example 1: Single agent “task runner”

```text
agent = Agent(
  name="executor",
  prompt="You are a careful executor. Ask questions when blocked."
) # TODO: actual API

result = agent.run(task="Summarize docs/concepts.md") # TODO: actual API
print(result.output)
```

## Example 2: Two-agent squad (planner + executor)

```text
planner = Agent(name="planner", prompt="Produce a step-by-step plan.")  # TODO
executor = Agent(name="executor", prompt="Implement the plan in patches.") # TODO

squad = Squad(agents=[planner, executor])  # TODO
result = squad.run(task="Add issue templates and CI workflow")  # TODO

print(result.output)
```

## Example 3: Review loop (executor + reviewer)

```text
executor = Agent(name="executor", prompt="Make the change.")   # TODO
reviewer = Agent(name="reviewer", prompt="Critique and verify.") # TODO

squad = Squad(agents=[executor, reviewer]) # TODO
result = squad.run(task="Refactor module layout without breaking public API") # TODO
```
