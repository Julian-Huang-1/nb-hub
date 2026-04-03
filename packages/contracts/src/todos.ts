import type { IsoDateString } from "./common.js";

export type TodoDto = {
  id: number;
  title: string;
  completed: boolean;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type CreateTodoBody = {
  title: string;
};

export type UpdateTodoBody = {
  title?: string;
  completed?: boolean;
};

export type ListTodosResponseData = TodoDto[];

export type CreateTodoResponseData = TodoDto;

export type UpdateTodoResponseData = TodoDto;

export type DeleteTodoResponseData = {
  id: number;
};
