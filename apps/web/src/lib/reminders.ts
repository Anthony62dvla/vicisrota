/** "30 minutes", "1 hour", "2 hours". */
export const beforeLabel = (minutes: number) => (minutes < 60 ? `${minutes} minutes` : minutes === 60 ? "1 hour" : `${minutes / 60} hours`);
