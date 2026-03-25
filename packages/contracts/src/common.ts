/** ISO 8601 string after `JSON.parse` of API responses (Express serializes `Date` this way). */
export type IsoDateString = string;

export type ApiSuccess<T> = {
  status: "ok";
  data: T;
};

export type ApiError = {
  status: "error";
  message: string;
};

export type ApiResult<T> = ApiSuccess<T> | ApiError;
