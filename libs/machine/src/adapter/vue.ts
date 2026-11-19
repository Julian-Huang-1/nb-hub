import type { InjectionKey } from "vue";
import type { EventObject, Machine, MachineDefinition, Snapshot } from "../core";
import {
  getCurrentInstance,
  getCurrentScope,
  inject,
  onScopeDispose,
  provide,
  shallowReadonly,
  shallowRef,
} from "vue";
import { createMachine } from "../core";

type MachineReader<S, E> = Pick<Machine<S, E>, "getSnapshot" | "send" | "subscribe">;

/** 只把 selector 的结果变成响应式数据，而不是把整个 machine 变成 reactive。 */
export function useSelector<S, E, T>(
  machine: MachineReader<S, E>,
  selector: (snapshot: S) => T,
  compare: (previous: T, next: T) => boolean = Object.is,
) {
  if (!getCurrentScope()) throw new Error("useSelector 必须在 setup 或 effectScope 中调用");

  let current = selector(machine.getSnapshot());
  const selected = shallowRef<T>(current);

  function update(snapshot: S) {
    const next = selector(snapshot);
    if (!compare(current, next)) {
      current = next;
      selected.value = next;
    }
  }

  const unsubscribe = machine.subscribe(update);
  onScopeDispose(unsubscribe);
  update(machine.getSnapshot());

  return shallowReadonly(selected);
}

function createConsumer<S, E>(machine: Machine<S, E>) {
  return {
    getSnapshot: machine.getSnapshot,
    send: machine.send,
    subscribe: machine.subscribe,
    useSelector<T>(selector: (snapshot: S) => T, compare?: (previous: T, next: T) => boolean) {
      return useSelector(machine, selector, compare);
    },
  };
}

type MachineConsumer<S, E> = ReturnType<typeof createConsumer<S, E>>;

export interface MachineScope {
  getOrCreate: <S extends string, C extends object, E extends EventObject>(
    definition: MachineDefinition<S, C, E>,
  ) => MachineConsumer<Snapshot<S, C>, E>;
}

function createMachineScope() {
  // 每个作用域拥有独立的注册表。创建实例的子组件不拥有它的生命周期。
  const registry = new Map<object, { consumer: unknown; stop: () => void }>();
  let disposed = false;

  const scope: MachineScope = {
    getOrCreate<S extends string, C extends object, E extends EventObject>(
      definition: MachineDefinition<S, C, E>,
    ): MachineConsumer<Snapshot<S, C>, E> {
      if (disposed) throw new Error("MachineScope 已销毁");

      const existing = registry.get(definition);
      if (existing) {
        // 相同定义对象始终对应同一组快照/事件类型。
        return existing.consumer as MachineConsumer<Snapshot<S, C>, E>;
      }

      const machine = createMachine(definition);
      const consumer = createConsumer(machine);
      registry.set(definition, { consumer, stop: machine.stop });
      machine.start();
      return consumer;
    },
  };

  function dispose() {
    disposed = true;
    for (const entry of registry.values()) entry.stop();
    registry.clear();
  }

  return { scope, dispose };
}

const machineScopeKey: InjectionKey<MachineScope> = Symbol("MachineScope");

/** 页面 setup 只调用一次；不预先创建任何业务 machine。 */
export function provideMachineScope(): MachineScope {
  if (!getCurrentInstance()) throw new Error("provideMachineScope 必须在组件 setup 中调用");

  const { scope, dispose } = createMachineScope();
  onScopeDispose(dispose);
  provide(machineScopeKey, scope);
  return scope;
}

/** 后代按定义惰性创建或复用最近作用域中的实例。 */
export function useMachine<S extends string, C extends object, E extends EventObject>(
  definition: MachineDefinition<S, C, E>,
) {
  if (!getCurrentInstance()) throw new Error("useMachine 必须在组件 setup 中调用");

  const scope = inject(machineScopeKey, undefined);
  if (!scope) throw new Error("缺少 MachineScope，请先在祖先组件调用 provideMachineScope()");
  return scope.getOrCreate(definition);
}
