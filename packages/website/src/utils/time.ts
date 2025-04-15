export function getTimeAgoString(unix: number) {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - unix;

  if (diff < 60) {
    return "Just now";
  } else if (diff > 60 && diff < 86400) {
    const hours = Math.round(diff / 60 / 60);
    return `${hours}h ago`;
  } else {
    return new Date(unix * 1000).toLocaleString();
  }
}
