import { db } from '../db';
import { notificaciones, administradores } from '@workspace/db/schema';
import type { InferInsertModel } from 'drizzle-orm';

type NuevaNotif = Omit<InferInsertModel<typeof notificaciones>, 'id' | 'creadaEn' | 'leida' | 'leidaEn'>;

export async function notificar(data: NuevaNotif): Promise<void> {
  try {
    await db.insert(notificaciones).values(data);
  } catch (e) {
    console.error('[notificar] Error:', e);
  }
}

export async function notificarATodosLosAdmins(data: Omit<NuevaNotif, 'userId'>): Promise<void> {
  try {
    const admins = await db.select({ userId: administradores.userId }).from(administradores);
    if (admins.length === 0) return;
    await db.insert(notificaciones).values(admins.map((a) => ({ ...data, userId: a.userId })));
  } catch (e) {
    console.error('[notificarATodosLosAdmins] Error:', e);
  }
}
