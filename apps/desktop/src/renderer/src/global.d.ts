interface Window {
  nbHub: { apiUrl: string; authStorage: { get(): Promise<string | null>; set(token: string | null): Promise<void> } };
}
