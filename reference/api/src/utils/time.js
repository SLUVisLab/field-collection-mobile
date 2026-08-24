function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function toDateInstance(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value.toDate === 'function') {
    return toDateInstance(value.toDate());
  }

  if (value.$date) {
    return toDateInstance(value.$date);
  }

  if (typeof value.getTime === 'function') {
    try {
      const time = value.getTime();
      return Number.isNaN(time) ? null : new Date(time);
    } catch (e) {
      return null;
    }
  }

  return null;
}

function getTimestampMillis(rawTimestamp) {
  if (rawTimestamp == null) {
    return null;
  }

  if (isFiniteNumber(rawTimestamp)) {
    return rawTimestamp > 1e12 ? rawTimestamp : Math.round(rawTimestamp * 1000);
  }

  if (typeof rawTimestamp === 'string') {
    const numeric = Number(rawTimestamp);
    if (!Number.isNaN(numeric)) {
      return numeric > 1e12 ? numeric : Math.round(numeric * 1000);
    }

    const parsed = Date.parse(rawTimestamp);
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (typeof rawTimestamp === 'object') {
    if (typeof rawTimestamp._seconds === 'number') {
      const nanos = typeof rawTimestamp._nanoseconds === 'number' ? rawTimestamp._nanoseconds : 0;
      return Math.round(rawTimestamp._seconds * 1000 + nanos / 1e6);
    }

    if (typeof rawTimestamp.seconds === 'number') {
      const nanos = typeof rawTimestamp.nanoseconds === 'number' ? rawTimestamp.nanoseconds : 0;
      return Math.round(rawTimestamp.seconds * 1000 + nanos / 1e6);
    }

    const dateValue = toDateInstance(rawTimestamp);
    if (dateValue) {
      return dateValue.getTime();
    }
  }

  return null;
}

function compareTimestampValues(a, b) {
  const tsA = getTimestampMillis(a);
  const tsB = getTimestampMillis(b);

  if (tsA === null && tsB === null) {
    return 0;
  }

  if (tsA === null) {
    return 1;
  }

  if (tsB === null) {
    return -1;
  }

  if (tsA === tsB) {
    return 0;
  }

  return tsA - tsB;
}

function compareObservationTimestamps(obsA, obsB) {
  return compareTimestampValues(obsA && obsA.timestamp, obsB && obsB.timestamp);
}

module.exports = {
  getTimestampMillis,
  compareTimestampValues,
  compareObservationTimestamps
};
