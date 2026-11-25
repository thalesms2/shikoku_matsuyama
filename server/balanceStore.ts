import { DatabaseSync } from "node:sqlite";

/** Balanceamento guardado: `doc` nulo = os padrões do jogo */
export interface StoredBalance {
  /** Sobe a cada gravação (0 = nunca gravado) */
  version: number;
  doc: unknown;
}

/** Valores de balanceamento do jogo num banco SQLite (uma linha só) */
export class BalanceStore {
  constructor(private readonly db: DatabaseSync) {
    db.exec(`CREATE TABLE IF NOT EXISTS balance (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      doc TEXT,
      version INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`);
  }

  /** Abre (ou cria) o banco no caminho dado (`:memory:` nos testes) */
  static open(path: string): BalanceStore {
    return new BalanceStore(new DatabaseSync(path));
  }

  /** Valores atuais; JSON ilegível no banco conta como os padrões */
  get(): StoredBalance {
    const row = this.db
      .prepare("SELECT doc, version FROM balance WHERE id = 1")
      .get() as { doc: string | null; version: number } | undefined;
    if (!row) return { version: 0, doc: null };
    let doc: unknown = null;
    try {
      doc = row.doc === null ? null : JSON.parse(row.doc);
    } catch {
      doc = null;
    }
    return { version: row.version, doc };
  }

  /** Grava os valores (`null` volta aos padrões) e sobe a versão */
  set(doc: unknown, now = Date.now()): StoredBalance {
    const version = this.get().version + 1;
    this.db
      .prepare(
        `INSERT INTO balance (id, doc, version, updated_at) VALUES (1, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           doc = excluded.doc, version = excluded.version,
           updated_at = excluded.updated_at`,
      )
      .run(doc === null ? null : JSON.stringify(doc), version, now);
    return { version, doc };
  }
}
