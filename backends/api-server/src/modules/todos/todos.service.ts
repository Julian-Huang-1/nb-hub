import type { TodoDto, UpdateTodoBody } from "@nb-hub/contracts";
import { todosRepository, type TodoRow } from "./todos.repository.js";

const toDto = (row: TodoRow): TodoDto => ({
  id: row.id,
  title: row.title,
  completed: row.completed,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const todosService = {
  list: (userId: string) => todosRepository.listByUser(userId).map(toDto),

  create: (userId: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) throw new Error("title is required");
    const row = todosRepository.insert(userId, trimmed);
    if (!row) throw new Error("failed to create");
    return toDto(row);
  },

  update: (userId: string, id: number, body: UpdateTodoBody) => {
    if (body.title !== undefined && !body.title.trim()) {
      throw new Error("title cannot be empty");
    }
    if (body.title === undefined && body.completed === undefined) {
      throw new Error("no fields to update");
    }
    const row = todosRepository.update(userId, id, {
      title: body.title,
      completed: body.completed,
    });
    if (!row) throw new Error("todo not found");
    return toDto(row);
  },

  remove: (userId: string, id: number) => {
    const ok = todosRepository.delete(userId, id);
    if (!ok) throw new Error("todo not found");
    return { id };
  },
};
