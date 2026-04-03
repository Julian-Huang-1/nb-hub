import type {
  CreateTodoBody,
  CreateTodoResponseData,
  DeleteTodoResponseData,
  ListTodosResponseData,
  TodoDto,
  UpdateTodoBody,
  UpdateTodoResponseData,
} from "@nb-hub/contracts";
import { apiOkData } from "./http";

export async function listTodos(): Promise<ListTodosResponseData> {
  return apiOkData<ListTodosResponseData>("/todos");
}

export async function createTodo(
  body: CreateTodoBody,
): Promise<CreateTodoResponseData> {
  return apiOkData<CreateTodoResponseData>("/todos", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateTodo(
  id: number,
  body: UpdateTodoBody,
): Promise<UpdateTodoResponseData> {
  return apiOkData<UpdateTodoResponseData>(`/todos/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteTodo(id: number): Promise<DeleteTodoResponseData> {
  return apiOkData<DeleteTodoResponseData>(`/todos/${id}`, {
    method: "DELETE",
  });
}

export type { TodoDto };
