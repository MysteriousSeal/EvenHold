// A value kept for each thing it's asked of (an inn's mugs, a crypt's count of guards), made the first time it's asked
// (`make`) and given again after, for as long as the thing itself is kept (a WeakMap: let go with it).

export function kept<K extends object, V>(): (key: K, make: () => V) => V {
  const values = new WeakMap<K, V>();
  return (key, make) => {
    if (!values.has(key)) values.set(key, make());
    return values.get(key)!;
  };
}
