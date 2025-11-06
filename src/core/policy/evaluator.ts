const checkConstraints = (
  input: Record<string, any>,
  constraints: Record<string, number>
): boolean => {
  // now only handle max and min constraints
  // TODO: handle other constraints
  for (const [key, threshold] of Object.entries(constraints)) {
    if (key.startsWith("max_")) {
      const field = key.replace("max_", "");
      if (input[field] > threshold) return false;
    }
    if (key.startsWith("min_")) {
      const field = key.replace("min_", "");
      if (input[field] < threshold) return false;
    }
  }
  return true;
};
