/**
 * Gets the timestamp for 20 hours ago from the current date and time.
 * 
 * @returns {string} The ISO string representation of the timestamp for 20 hours ago.
 */
const getTimestampFor20HoursAgo = () => {
    const currentDate = new Date();
    currentDate.setHours(currentDate.getHours() - 20);
    return currentDate.toISOString();
  };
  
  console.log(getTimestampFor20HoursAgo());