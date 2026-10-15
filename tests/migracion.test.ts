import { describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

describe('migración desde la versión 1', () => {
  it('convierte servicios, asignaciones, gastos únicos y salarios', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gastos-'))
    const file = path.join(dir, 'gastos.db')
    const v1 = new Database(file)
    v1.exec(`
      CREATE TABLE config (clave TEXT PRIMARY KEY, valor TEXT NOT NULL DEFAULT '');
      CREATE TABLE servicios (id TEXT PRIMARY KEY, nombre TEXT, categoria TEXT, tipo_gasto TEXT, monto_fijo REAL,
        periodicidad TEXT, mes_inicio INTEGER, mes_fin INTEGER, dia_vencimiento INTEGER, activo INTEGER DEFAULT 1,
        comentario TEXT DEFAULT '', cuota_doble INTEGER DEFAULT 0, meses_cuota_doble TEXT DEFAULT '[]');
      CREATE TABLE asignaciones_mes (id TEXT PRIMARY KEY, mes INTEGER, "año" INTEGER, servicio_id TEXT, servicio_nombre TEXT,
        monto REAL, asignado_a TEXT, pagado INTEGER, fecha_pago TEXT, creado_en TEXT DEFAULT (datetime('now')));
      CREATE TABLE gastos_unicos (id TEXT PRIMARY KEY, nombre TEXT, categoria TEXT, monto_ref REAL, comentario TEXT DEFAULT '');
      CREATE TABLE usos_gasto_unico (id TEXT PRIMARY KEY, gasto_unico_id TEXT, gasto_nombre TEXT, gasto_categoria TEXT,
        mes INTEGER, "año" INTEGER, monto REAL, asignado_a TEXT, pagado INTEGER, fecha_pago TEXT, creado_en TEXT DEFAULT (datetime('now')));
      INSERT INTO config VALUES ('persona1_nombre','César'),('persona1_salario','7400'),('persona1_moneda','PEN'),
        ('persona2_nombre','R'),('persona2_salario','2000'),('persona2_moneda','USD'),('moneda','PEN'),('tipo_cambio','3.7');
      INSERT INTO servicios VALUES ('srv-1','Hipoteca','hipoteca','fijo',3200,'mensual',NULL,NULL,5,1,'cta 123',1,'[7,12]');
      INSERT INTO servicios VALUES ('srv-2','Colegio','kinder','fijo',1100,'personalizado',3,12,10,1,'',0,'[]');
      INSERT INTO asignaciones_mes (id,mes,"año",servicio_id,servicio_nombre,monto,asignado_a,pagado,fecha_pago)
        VALUES ('asig-1',9,2026,'srv-1','Hipoteca',3200,'ambos',1,'2026-09-05');
      INSERT INTO gastos_unicos VALUES ('gu-1','Médico','otro',150,'');
      INSERT INTO usos_gasto_unico (id,gasto_unico_id,gasto_nombre,gasto_categoria,mes,"año",monto,asignado_a,pagado)
        VALUES ('uso-1','gu-1','Médico','otro',9,2026,180,'2',0);
    `)
    v1.close()

    process.env.DB_PATH = file
    const { getDb } = await import('@/lib/db')
    const db = getDb()
    const conceptos = db.prepare('SELECT * FROM conceptos ORDER BY id').all() as any[]
    expect(conceptos.map(c => [c.id, c.tipo, c.categoria])).toEqual([
      ['gu-1', 'ocasional', 'otro'], ['srv-1', 'fijo', 'vivienda'], ['srv-2', 'fijo', 'educacion'],
    ])
    expect(JSON.parse(conceptos[1].meses_cuota_doble)).toEqual([7, 12])
    expect(JSON.parse(conceptos[2].meses_activos)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    const pagos = db.prepare('SELECT * FROM pagos ORDER BY id').all() as any[]
    expect(pagos.map(p => [p.id, p.concepto_id, p.tipo, p.anio, p.mes, p.monto, p.asignado_a, p.pagado])).toEqual([
      ['asig-1', 'srv-1', 'fijo', 2026, 9, 3200, 'ambos', 1],
      ['uso-1', 'gu-1', 'ocasional', 2026, 9, 180, '2', 0],
    ])
    expect(db.prepare('SELECT nombre FROM personas ORDER BY id').all()).toEqual([{ nombre: 'César' }, { nombre: 'R' }])
    expect(db.prepare('SELECT salario1, moneda2, tipo_cambio FROM repartos').get()).toEqual({ salario1: 7400, moneda2: 'USD', tipo_cambio: 3.7 })
  })
})
