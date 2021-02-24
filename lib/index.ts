interface Options {
  dbName: string;
  store: string;
  version?: number;
  autoIncrement?: boolean;
  keyPath?: string;
  uint8Array?: boolean;
}

export const NanoIndexed = ({
  dbName,
  store,
  autoIncrement,
  keyPath,
  version,
  uint8Array,
}: Options) => {
  const isHaveIndexedDb = typeof window.indexedDB !== "undefined";
  if (!isHaveIndexedDb) {
    console.error(
      "[nano-indexed] [Error] Your browser not have indexedDB, Now use localStorage."
    );
  }
  let db: IDBDatabase;

  // 兼容无 TextDecoder 和 无 TextEncoder 场景
  if (
    uint8Array &&
    (typeof TextDecoder === "undefined" ||
      typeof TextEncoder === "undefined" ||
      !isHaveIndexedDb)
  ) {
    uint8Array = false;
  }

  let textEncoder: TextEncoder;
  let textDecoder: TextDecoder;
  if (uint8Array) {
    textEncoder = new TextEncoder();
    textDecoder = new TextDecoder();
  }

  const initDb = () => {
    return new Promise((res) => {
      if (!db) {
        const reqDb = window.indexedDB.open(dbName, version);
        reqDb.onerror = console.error;
        reqDb.onsuccess = (event: any) => {
          if (!db) {
            db = event.target.result;
          }
          res(void 0);
        };
        reqDb.onupgradeneeded = function (event: any) {
          if (!db) {
            db = event.target.result;
          }
          db.createObjectStore(store, { autoIncrement, keyPath });
        };
      } else {
        res(void 0);
      }
    });
  };

  const out = {
    set: async (key: string | number | null, obj: any) => {
      if (!isHaveIndexedDb) {
        return new Promise((res, rej) => {
          localStorage.setItem((key || 1).toString(), JSON.stringify(obj));
          res(void 0);
        });
      }
      if (!db) {
        await initDb();
      }
      if (uint8Array) {
        if (typeof obj !== "string") {
          obj = textEncoder.encode(JSON.stringify(obj));
        } else {
          obj = textEncoder.encode(obj);
        }
      }
      return new Promise((res) => {
        if (db.objectStoreNames.contains(store)) {
          const transaction = db.transaction([store], "readwrite");
          const objectStore = transaction.objectStore(store);
          const request = key
            ? objectStore.put(obj, key)
            : objectStore.put(obj);
          request.onerror = (err) => {
            console.error(err);
            res(void 0);
          };
          request.onsuccess = res;
        } else {
          res(void 0);
        }
      });
    },
    update: async (key: string | number, obj: any): Promise<any> => {
      const old = await out.get(key);
      if (!old) {
        await out.set(key, obj);
        return obj;
      }
      const next = Object.assign(Object.assign({}, old), obj);
      await out.set(key, next);
      return next;
    },
    get: async (key: string | number): Promise<any> => {
      if (!isHaveIndexedDb) {
        return new Promise((res) => {
          let data = localStorage.getItem((key || 1).toString());
          if (data) {
            try {
              data = JSON.parse(data);
            } catch (err) {}
          }
          res(data);
        });
      }
      if (!db) {
        await initDb();
      }
      return new Promise((res) => {
        if (db.objectStoreNames.contains(store)) {
          const transaction = db.transaction([store]);
          const objectStore = transaction.objectStore(store);
          const request = objectStore.get(key);
          request.onsuccess = function (event: any) {
            let data = event.target.result;
            if (uint8Array) {
              data = textDecoder.decode(data);
              try {
                data = JSON.parse(data);
              } catch (err) {}
            }
            res(data);
          };
        } else {
          res(void 0 as any);
        }
      });
    },
    remove: async (key: string | number): Promise<any> => {
      if (!isHaveIndexedDb) {
        return new Promise((res) => {
          localStorage.removeItem((key || 1).toString());
          res(void 0);
        });
      }
      if (!db) {
        await initDb();
      }

      return new Promise((res) => {
        if (db.objectStoreNames.contains(store)) {
          const transaction = db.transaction([store], "readwrite");
          const objectStore = transaction.objectStore(store);
          const request = objectStore.delete(key);
          request.onerror = (err) => {
            console.error(err);
            res(void 0);
          };
          request.onsuccess = res as any;
        } else {
          res(void 0);
        }
      });
    },
  };
  return out;
};
