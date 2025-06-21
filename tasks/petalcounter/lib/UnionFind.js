class UnionFind {
  constructor(mergeF = null) {
    this.V = {};       // Map from element to index
    this.Vl = [];      // List of keys
    this.parent = [];  // Parent pointers
    this.size = [];    // Size of each tree
    this.mergeF = mergeF;
    this.data = {};    // Data associated with each element
  }

  add(v, data = null) {
    const key = JSON.stringify(v);  // Use JSON stringification for tuple-like keys
    if (!(key in this.V)) {
      const i = this.Vl.length;
      this.V[key] = i;
      this.Vl.push(v);
      this.parent.push(i);
      this.size.push(1);
      this.data[key] = data;
    }
  }

  find_parent(v) {
    const key = JSON.stringify(v);
    let i = this.V[key];
    let p = i;
    while (this.parent[p] !== p) {
      p = this.parent[p];
    }
    while (i !== p) {
      const j = i;
      i = this.parent[i];
      this.parent[j] = p;
    }
    return this.Vl[p];
  }

  find_size(v) {
    const key = JSON.stringify(this.find_parent(v));
    return this.size[this.V[key]];
  }

  merge(u, v) {
    const su = this.find_size(u);
    const sv = this.find_size(v);
    const ku = JSON.stringify(u);
    const kv = JSON.stringify(v);
    let pu = this.parent[this.V[ku]];
    let pv = this.parent[this.V[kv]];
    if (pu === pv) {
      return [this.Vl[pu], null];
    }
    const d = this.mergeF(this.data[this.Vl[pu]], this.data[this.Vl[pv]]);
    if (sv <= su) {
      [pu, pv] = [pv, pu];
    }
    this.parent[pv] = pu;
    this.size[pu] = su + sv;
    const newRootKey = JSON.stringify(this.Vl[pu]);
    this.data[newRootKey] = d;
    return [this.Vl[pu], this.Vl[pv]];
  }

  getData(v) {
    const key = JSON.stringify(this.find_parent(v));
    return this.data[key];
  }
}

function mergeF(a, b) {
  const options = [
    [a.max, a.elderi, a.elderj],
    [b.max, b.elderi, b.elderj]
  ];
  const [m, ei, ej] = options.reduce((acc, curr) => acc[0] > curr[0] ? acc : curr);
  return { max: m, elderi: ei, elderj: ej };
}

function persistence(f) {
  const fi = [];
  for (let i = 0; i < f.length; i++) {
    for (let j = 0; j < f[0].length; j++) {
      fi.push([f[i][j], i, j]);
    }
  }

  fi.sort((a, b) => b[0] - a[0]);

  const uf = new UnionFind(mergeF);
  const pairs = [];

  for (const [v, i, j] of fi) {
    const key = JSON.stringify([i, j]);
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

    for (const dir in neighbors) {
      const nKey = JSON.stringify(neighbors[dir]);
      if (nKey in uf.V) {
        flags[dir] = true;
        parents[dir] = uf.find_parent(neighbors[dir]);
        data[dir] = uf.getData(neighbors[dir]);
      } else {
        flags[dir] = false;
      }
    }

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
      if (parents[a] && parents[b] && JSON.stringify(parents[a]) !== JSON.stringify(parents[b])) {
        const [d, ki, kj] = [data[a], data[b]].reduce((acc, curr) =>
          acc.max < curr.max ? acc : curr
        );
        pairs.push([d.max - v, [i, j], [d.elderi, d.elderj]]);
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
  return pairs;
}

function rel_persistence(f, threshold = 1e4) {
  const fi = f.map((val, i) => [val, i]).sort((a, b) => b[0] - a[0]);

  const uf = new UnionFind((a, b) => {
    const [maxA, elderA] = [a.max, a.elder];
    const [maxB, elderB] = [b.max, b.elder];
    return maxA > maxB ? a : b;
  });

  const pairs = [];

  for (const [v, i] of fi) {
    uf.add(i, { max: v, elder: i });

    if ((i - 1) in uf.V && (i + 1) in uf.V) {
      const a = uf.getData(i - 1);
      const b = uf.getData(i + 1);
      const [d, j] = a.max < b.max ? [a.max, a.elder] : [b.max, b.elder];
      if ((d - v) > threshold) {
        pairs.push([(d - v) / d, i, j]);
      }
    }

    if ((i - 1) in uf.V) {
      uf.merge(i - 1, i);
    }
    if ((i + 1) in uf.V) {
      uf.merge(i, i + 1);
    }
  }

  pairs.push([Infinity, null, fi[0][1]]);
  return pairs;
}

export {
  UnionFind,
  mergeF,
  persistence,
  rel_persistence
};