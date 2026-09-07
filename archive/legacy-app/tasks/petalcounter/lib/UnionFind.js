class UnionFind {
  constructor(mergeF = null) {
    this.V = new Map();   // Map from element to index (using Map instead of {})
    this.Vl = [];         // List of keys
    this.parent = [];     // Parent pointers
    this.size = [];       // Size of each tree
    this.mergeF = mergeF;
    this.data = new Map(); // Data associated with each element (using Map)
  }

  add(v, data = null) {
    const key = JSON.stringify(v);
    if (!this.V.has(key)) {
      const i = this.Vl.length;
      this.V.set(key, i);
      this.Vl.push(v);
      this.parent.push(i);
      this.size.push(1);
      this.data.set(key, data);
    }
  }

  find_parent(v) {
    const key = JSON.stringify(v);
    let i = this.V.get(key);
    
    // Safety counter to prevent infinite loops
    let safetyCounter = 0;
    const MAX_ITERATIONS = 10000;
    
    // First pass: find the root
    let p = i;
    while (this.parent[p] !== p) {
      if (safetyCounter++ > MAX_ITERATIONS) {
        console.error(`Possible infinite loop detected in find_parent`);
        break;
      }
      
      // Path compression during traversal
      const next = this.parent[p];
      if (this.parent[next] !== next) {
        this.parent[p] = this.parent[next]; // Skip one level
      }
      
      p = this.parent[p];
    }
    
    // Second pass: path compression
    safetyCounter = 0;
    while (i !== p && safetyCounter++ < MAX_ITERATIONS) {
      const j = i;
      i = this.parent[i];
      this.parent[j] = p;
    }
    
    return this.Vl[p];
  }

  find_size(v) {
    const parent = this.find_parent(v);
    const key = JSON.stringify(parent);
    return this.size[this.V.get(key)];
  }

  merge(u, v) {
    const su = this.find_size(u);
    const sv = this.find_size(v);
    
    const ku = JSON.stringify(u);
    const kv = JSON.stringify(v);
    let pu = this.parent[this.V.get(ku)];
    let pv = this.parent[this.V.get(kv)];
    
    if (pu === pv) {
      return [this.Vl[pu], null];
    }
    
    // Get the correct keys for the data lookup
    const puElement = this.Vl[pu];
    const pvElement = this.Vl[pv];
    const puKey = JSON.stringify(puElement);
    const pvKey = JSON.stringify(pvElement);
    
    // Get data from Map
    const puData = this.data.get(puKey);
    const pvData = this.data.get(pvKey);
    
    const d = this.mergeF(puData, pvData);
    
    if (sv <= su) {
      [pu, pv] = [pv, pu];
    }
    
    this.parent[pv] = pu;
    this.size[pu] = su + sv;
    
    const newRootElement = this.Vl[pu];
    const newRootKey = JSON.stringify(newRootElement);
    this.data.set(newRootKey, d);
    
    return [this.Vl[pu], this.Vl[pv]];
  }

  getData(v) {
    const parent = this.find_parent(v);
    const key = JSON.stringify(parent);
    return this.data.get(key);
  }
}

function mergeF(a, b) {
  const options = [
    [a.max, a.elderi, a.elderj],
    [b.max, b.elderi, b.elderj]
  ];
  
  const [m, ei, ej] = options.reduce((acc, curr) => {
    return acc[0] > curr[0] ? acc : curr;
  });
  
  return { max: m, elderi: ei, elderj: ej };
}

function persistence(f) {
  console.log(`Starting persistence calculation for ${f.length}x${f[0].length} matrix`);
  
  const fi = [];
  for (let i = 0; i < f.length; i++) {
    for (let j = 0; j < f[0].length; j++) {
      fi.push([f[i][j], i, j]);
    }
  }

  fi.sort((a, b) => b[0] - a[0]);

  const uf = new UnionFind(mergeF);
  const pairs = [];

  const totalElements = fi.length;
  const reportInterval = Math.max(1, Math.floor(totalElements / 20));

  for (let idx = 0; idx < fi.length; idx++) {
    if (idx % reportInterval === 0 || idx === fi.length - 1) {
      console.log(`Progress: ${idx}/${totalElements} (${Math.round(idx/totalElements*100)}%)`);
    }
    
    const [v, i, j] = fi[idx];
    
    // Add the current element
    uf.add([i, j], { max: v, elderi: i, elderj: j });

    const neighbors = {
      top: [i - 1, j],
      bot: [i + 1, j],
      lef: [i, j - 1],
      rig: [i, j + 1],
    };
    const flags = {};
    const parents = {};
    const data = {};

    // Check which neighbors exist - using Map.has()
    for (const dir in neighbors) {
      const nKey = JSON.stringify(neighbors[dir]);
      if (uf.V.has(nKey)) {
        flags[dir] = true;
        parents[dir] = uf.find_parent(neighbors[dir]);
        data[dir] = uf.getData(neighbors[dir]);
      } else {
        flags[dir] = false;
      }
    }

    // Merge with existing neighbors
    for (const dir in flags) {
      if (flags[dir]) {
        if (['top', 'lef'].includes(dir)) {
          uf.merge(neighbors[dir], [i, j]);
        } else {
          uf.merge([i, j], neighbors[dir]);
        }
      }
    }

    const combos = [
      [['lef', 'rig'], ['top', 'bot']],
      [['rig', 'top'], ['lef', 'top'], ['lef', 'bot'], ['rig', 'bot']],
    ];

    function recordIfDifferent(a, b) {
      const dataA = data[a];
      const dataB = data[b];

      if (!dataA || !dataB) {
        return;
      }

      const parentA = parents[a];
      const parentB = parents[b];
      if (!parentA || !parentB) {
        return;
      }

      if (JSON.stringify(parentA) !== JSON.stringify(parentB)) {
        // Use winner object directly
        const winner = dataA.max < dataB.max ? dataA : dataB;
        pairs.push([winner.max - v, [i, j], [winner.elderi, winner.elderj]]);
      }
    }

    for (const [a, b] of combos.flat()) {
      if (flags[a] && flags[b]) {
        recordIfDifferent(a, b);
      }
    }
  }

  const [_, i0, j0] = fi[0];
  pairs.push([Infinity, null, [i0, j0]]);
  console.log(`Persistence calculation complete, found ${pairs.length} pairs`);
  return pairs;
}

function rel_persistence(f, threshold = 1e4) {
  console.log(`Starting rel_persistence with threshold=${threshold}`);
  
  const fi = f.map((val, i) => [val, i])
    .sort((a, b) => b[0] - a[0]);

  const uf = new UnionFind((a, b) => {
    const [maxA, elderA] = [a.max, a.elder];
    const [maxB, elderB] = [b.max, b.elder];
    return maxA > maxB ? a : b;
  });

  const pairs = [];
  const totalElements = fi.length;
  const reportInterval = Math.max(1, Math.floor(totalElements / 20));

  for (let idx = 0; idx < fi.length; idx++) {
    if (idx % reportInterval === 0) {
      console.log(`Progress: ${idx}/${totalElements} (${Math.round(idx/totalElements*100)}%)`);
    }
    
    const [v, i] = fi[idx];
    uf.add(i, { max: v, elder: i });

    // Check if neighbors exist - using Map.has()
    if (uf.V.has(JSON.stringify(i - 1)) && uf.V.has(JSON.stringify(i + 1))) {
      const a = uf.getData(i - 1);
      const b = uf.getData(i + 1);
      
      const [d, j] = a.max < b.max ? [a.max, a.elder] : [b.max, b.elder];
      
      if ((d - v) > threshold) {
        const persistenceRatio = (d - v) / d;
        pairs.push([persistenceRatio, i, j]);
      }
    }

    if (uf.V.has(JSON.stringify(i - 1))) {
      uf.merge(i - 1, i);
    }
    if (uf.V.has(JSON.stringify(i + 1))) {
      uf.merge(i, i + 1);
    }
  }

  pairs.push([Infinity, null, fi[0][1]]);
  console.log(`Rel_persistence complete, found ${pairs.length} pairs`);
  return pairs;
}

export {
  UnionFind,
  mergeF,
  persistence,
  rel_persistence
};