type NewTerminalHandler = () => void

let handler: NewTerminalHandler | null = null

export function setNewTerminalTabHandler(fn: NewTerminalHandler | null): void {
  handler = fn
}

export function requestNewTerminalTab(): void {
  handler?.()
}
