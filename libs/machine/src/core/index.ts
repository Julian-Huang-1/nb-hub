export interface EventObject {
  type: string;
}

export interface Snapshot<S extends string, C extends object> {
  readonly value: S;
  readonly context: Readonly<C>;
}

interface Args<C extends object, E extends EventObject> {
  context: Readonly<C>;
  event: E;
}

export interface Assignment<C extends object, E extends EventObject> {
  type: "assign";
  update: (args: Args<C, E>) => Partial<C>;
}

export function assign<C extends object, E extends EventObject>(
  update: Assignment<C, E>["update"],
): Assignment<C, E> {
  return { type: "assign", update };
}

export interface Transition<S extends string, C extends object, E extends EventObject> {
  target?: S;
  guard?: (args: Args<C, E>) => boolean;
  actions?: Assignment<C, E>[];
}

export interface MachineDefinition<S extends string, C extends object, E extends EventObject> {
  initial: S;
  // 每个实例获取独立初始数据；不要返回共享可变对象。
  context: () => C;
  states: Record<
    S,
    {
      on?: {
        [K in E["type"]]?:
          Transition<S, C, Extract<E, { type: K }>> | Transition<S, C, Extract<E, { type: K }>>[];
      };
    }
  >;
}

export interface Machine<SSnapshot, E> {
  getSnapshot: () => SSnapshot;
  send: (event: E) => void;
  subscribe: (listener: (snapshot: SSnapshot) => void) => () => void;
  start: () => void;
  stop: () => void;
}

export function transition<S extends string, C extends object, E extends EventObject>(
  definition: MachineDefinition<S, C, E>,
  snapshot: Snapshot<S, C>,
  event: E,
): Snapshot<S, C> {
  // 映射类型保证配置中的 event 是对应的判别联合分支。
  // 动态索引处恢复通用类型；实际只会以匹配的 event 执行该转换。
  const entry = definition.states[snapshot.value].on?.[event.type as E["type"]] as
    Transition<S, C, E> | Transition<S, C, E>[] | undefined;

  if (!entry) return snapshot;

  const candidates = Array.isArray(entry) ? entry : [entry];
  const selected = candidates.find(
    (candidate) => !candidate.guard || candidate.guard({ context: snapshot.context, event }),
  );

  if (!selected) return snapshot;

  let context = snapshot.context;
  for (const action of selected.actions ?? []) {
    const patch = action.update({ context, event });
    const changed = (Object.keys(patch) as (keyof C)[]).some(
      (key) => !Object.is(context[key], patch[key]),
    );

    // 后一个 assign 读取前一个 assign 更新后的 context。
    if (changed) context = Object.freeze({ ...context, ...patch });
  }

  const value = selected.target ?? snapshot.value;
  return value === snapshot.value && context === snapshot.context
    ? snapshot
    : Object.freeze({ value, context });
}

export function createMachine<S extends string, C extends object, E extends EventObject>(
  definition: MachineDefinition<S, C, E>,
): Machine<Snapshot<S, C>, E> {
  let snapshot: Snapshot<S, C> = Object.freeze({
    value: definition.initial,
    context: Object.freeze(definition.context()),
  });
  const listeners = new Set<(snapshot: Snapshot<S, C>) => void>();
  const queue: E[] = [];
  let started = false;
  let stopped = false;
  let processing = false;

  return {
    getSnapshot: () => snapshot,
    start() {
      if (!stopped) started = true;
    },
    stop() {
      stopped = true;
      queue.length = 0;
      listeners.clear();
    },
    subscribe(listener) {
      if (!stopped) listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    send(event) {
      if (!started || stopped) return;

      queue.push(event);
      if (processing) return;

      processing = true;
      try {
        while (queue.length) {
          if (stopped) break;
          const next = transition(definition, snapshot, queue.shift()!);
          if (next === snapshot) continue;

          snapshot = next;
          // 订阅者里 send 的事件先排队，当前快照先通知完所有订阅者。
          for (const listener of [...listeners]) {
            if (listeners.has(listener)) listener(next);
          }
        }
      } catch (error) {
        queue.length = 0;
        throw error;
      } finally {
        processing = false;
      }
    },
  };
}
