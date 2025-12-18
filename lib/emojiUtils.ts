// Get relevant emojis based on workflow type
export const getRelevantEmojis = (workflowType?: "text-to-3d" | "floorplan-3d"): string[] => {
  if (workflowType === "text-to-3d") {
    return ["🎨", "🏗️", "📦", "🎯", "🔮", "💎", "🌟", "✨", "🎭", "🎪", "🎬", "🎨"];
  } else if (workflowType === "floorplan-3d") {
    return ["🏠", "🏢", "🏗️", "📐", "🗺️", "🏛️", "🏘️", "🏰", "🏙️", "🏡", "🏘️", "🏦"];
  }
  // Generic emojis if workflow type is not specified
  return ["🎨", "🏗️", "📦", "🎯", "🔮", "💎", "🌟", "✨"];
};

// Get a random emoji based on workflow type and a seed (for consistency)
export const getRandomEmoji = (workflowType?: "text-to-3d" | "floorplan-3d", seed?: string): string => {
  const emojis = getRelevantEmojis(workflowType);
  // Use seed for consistent emoji selection per project/generation
  if (seed) {
    const index = seed.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) % emojis.length;
    return emojis[index];
  }
  return emojis[Math.floor(Math.random() * emojis.length)];
};

