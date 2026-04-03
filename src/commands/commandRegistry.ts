import type { CommandCategory, CommandDefinition } from "./types";

export class CommandRegistry {
  private commands = new Map<string, CommandDefinition>();

  registerCommand(command: CommandDefinition): void {
    if (this.commands.has(command.id)) {
      throw new Error(`Command "${command.id}" is already registered`);
    }
    this.commands.set(command.id, command);
  }

  getCommand(id: string): CommandDefinition | undefined {
    return this.commands.get(id);
  }

  executeCommand(id: string): boolean {
    const command = this.commands.get(id);
    if (!command) return false;
    if (command.precondition && !command.precondition()) return false;
    command.execute();
    return true;
  }

  getAllCommands(): CommandDefinition[] {
    return [...this.commands.values()].sort((a, b) => {
      const catCmp = a.category.localeCompare(b.category);
      if (catCmp !== 0) return catCmp;
      return a.label.localeCompare(b.label);
    });
  }

  getCommandsByCategory(category: CommandCategory): CommandDefinition[] {
    return [...this.commands.values()]
      .filter((c) => c.category === category)
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  getCategories(): CommandCategory[] {
    const categories = new Set<CommandCategory>();
    for (const cmd of this.commands.values()) {
      categories.add(cmd.category);
    }
    return [...categories].sort();
  }
}

export const commandRegistry = new CommandRegistry();
