/**
 * Pase de Examen — detalle de una inscripción con QR y acciones.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'wouter';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Download,
  Printer,
  X,
  BookOpen,
} from 'lucide-react';
import { EstudianteLayout } from './EstudianteLayout';
import { api } from '../../lib/api';
import type { PaseExamenData } from '../../lib/api';

// ── Helpers ───────────────────────────────────────────────────────────────

function parseFecha(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatFechaLarga(dateStr: string): string {
  const d = parseFecha(dateStr);
  return d.toLocaleDateString('es-MX', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  });
}

function estadoBadge(estado: string): { label: string; icon: React.ReactNode; bannerCls: string; bgCls: string } {
  switch (estado) {
    case 'pase_validado':
      return {
        label: 'Pase validado en sede',
        icon: <CheckCircle2 className="w-5 h-5" />,
        bannerCls: 'bg-green-50 border-green-200 text-green-800',
        bgCls: 'bg-green-600',
      };
    case 'pase_descargado':
      return {
        label: 'Pase descargado (provisional)',
        icon: <AlertTriangle className="w-5 h-5" />,
        bannerCls: 'bg-blue-50 border-blue-200 text-blue-800',
        bgCls: 'bg-blue-600',
      };
    case 'aprobado':
      return {
        label: 'Módulo aprobado',
        icon: <CheckCircle2 className="w-5 h-5" />,
        bannerCls: 'bg-emerald-50 border-emerald-200 text-emerald-800',
        bgCls: 'bg-emerald-600',
      };
    case 'reprobado':
      return {
        label: 'Módulo no aprobado',
        icon: <AlertTriangle className="w-5 h-5" />,
        bannerCls: 'bg-red-50 border-red-200 text-red-800',
        bgCls: 'bg-red-600',
      };
    default:
      return {
        label: 'Pase provisional — lleva identificación oficial',
        icon: <AlertTriangle className="w-5 h-5" />,
        bannerCls: 'bg-amber-50 border-amber-200 text-amber-800',
        bgCls: 'bg-amber-600',
      };
  }
}

// ── Modal de impresión ────────────────────────────────────────────────────

function PrintModal({ pase, onClose }: { pase: PaseExamenData; onClose: () => void }) {
  function handlePrint() {
    window.print();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200">
          <p className="font-bold text-stone-900">Vista de impresión</p>
          <button onClick={onClose} className="p-1 text-stone-400 hover:text-stone-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pase layout */}
        <div className="p-5 space-y-4">
          {/* Institution header */}
          <div className="text-center border-b border-stone-200 pb-4">
            <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">
              IEMSyS — Prepa Abierta Michoacán
            </p>
            <p className="font-bold text-stone-900 text-lg">PASE DE EXAMEN PROVISIONAL</p>
          </div>

          {/* QR code */}
          <div className="flex justify-center">
            <QRCodeSVG
              value={pase.qrPayload}
              size={160}
              fgColor="#7B1E3A"
              bgColor="#FFFFFF"
            />
          </div>

          {/* Info */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-stone-500">Folio:</span>
              <span className="font-mono font-bold text-stone-900">{pase.folio}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Alumno:</span>
              <span className="font-medium text-stone-900">{pase.estudiante.nombreCompleto}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">CURP:</span>
              <span className="font-mono text-stone-900">{pase.estudiante.curp}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Módulo:</span>
              <span className="font-medium text-stone-900">M{pase.modulo.numero} — {pase.modulo.nombre}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Fecha:</span>
              <span className="text-stone-900">{formatFechaLarga(pase.fechaExamen)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Hora:</span>
              <span className="text-stone-900">{pase.hora} hrs</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Sede:</span>
              <span className="text-stone-900">{pase.sede.nombre}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Dirección:</span>
              <span className="text-stone-900 text-right max-w-[60%]">{pase.sede.direccion}</span>
            </div>
          </div>

          <p className="text-[11px] text-stone-400 text-center border-t border-stone-100 pt-3">
            Presentar este pase con identificación oficial el día del examen.
          </p>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-stone-200 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50"
          >
            Cerrar
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 text-sm font-semibold bg-[var(--color-guinda-700)] text-white rounded-lg hover:bg-[var(--color-guinda-800)] flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────

export default function PaseExamen() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [pase, setPase] = useState<PaseExamenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPrint, setShowPrint] = useState(false);

  useEffect(() => {
    if (!id) return;
    api
      .get<PaseExamenData>(`/estudiante/convocatoria/pase/${id}`)
      .then(setPase)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  function handleDescargarPDF() {
    window.open(`/api/estudiante/convocatoria/pase/${id}/pdf`, '_blank');
  }

  if (loading) {
    return (
      <EstudianteLayout>
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="w-8 h-8 border-4 border-[var(--color-guinda-700)] border-t-transparent rounded-full animate-spin" />
        </div>
      </EstudianteLayout>
    );
  }

  if (error || !pase) {
    return (
      <EstudianteLayout>
        <div className="max-w-xl mx-auto px-4 py-10 text-center">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
          <p className="text-stone-600">{error || 'No se encontró el pase de examen.'}</p>
          <a href="/estudiante/convocatoria" className="text-sm text-[var(--color-guinda-700)] underline mt-4 inline-block">
            Regresar a Mi Convocatoria
          </a>
        </div>
      </EstudianteLayout>
    );
  }

  const badge = estadoBadge(pase.estado);

  const mapsUrl =
    pase.sede.latitud && pase.sede.longitud
      ? `https://www.google.com/maps?q=${pase.sede.latitud},${pase.sede.longitud}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          pase.sede.nombre + ' ' + pase.sede.direccion
        )}`;

  return (
    <EstudianteLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Back */}
        <a
          href="/estudiante/convocatoria"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-guinda-700)] hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Mis exámenes
        </a>

        {/* Status banner */}
        <div className={`border rounded-xl p-4 flex items-start gap-3 ${badge.bannerCls}`}>
          {badge.icon}
          <div>
            <p className="font-semibold text-sm">{badge.label}</p>
            {pase.estado === 'pase_validado' && pase.paseValidadoEn && (
              <p className="text-xs mt-0.5 opacity-80">
                Validado: {new Date(pase.paseValidadoEn).toLocaleString('es-MX')}
              </p>
            )}
            {pase.calificacion !== null && (
              <p className="text-xs mt-0.5 opacity-80">
                Calificación: {pase.calificacion}
              </p>
            )}
          </div>
        </div>

        {/* Pase card */}
        <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
          {/* Card header */}
          <div className="bg-gradient-to-r from-[var(--color-guinda-800)] to-[#9b2a4e] px-5 py-4 text-white">
            <p className="text-xs uppercase tracking-widest opacity-70 mb-1">
              IEMSyS — Prepa Abierta Michoacán
            </p>
            <p className="font-bold text-lg">Pase de Examen</p>
            <p className="font-mono text-sm opacity-90 mt-0.5">{pase.folio}</p>
          </div>

          {/* Card body */}
          <div className="p-5 space-y-5">
            {/* Estudiante */}
            <div>
              <p className="text-xs text-stone-400 uppercase tracking-wide mb-1">Alumno</p>
              <p className="font-semibold text-stone-900">{pase.estudiante.nombreCompleto}</p>
              <p className="font-mono text-sm text-stone-600">{pase.estudiante.curp}</p>
            </div>

            {/* Módulo */}
            <div className="flex items-start gap-3 p-3 bg-[var(--color-crema-100)] rounded-lg">
              <BookOpen className="w-5 h-5 text-[var(--color-guinda-700)] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-stone-400 uppercase tracking-wide mb-0.5">Módulo</p>
                <p className="font-semibold text-stone-900">
                  M{pase.modulo.numero} — {pase.modulo.nombre}
                </p>
              </div>
            </div>

            {/* Fecha y hora */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-start gap-2">
                <div className="bg-[var(--color-guinda-700)] text-white rounded-lg p-2 flex-shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs text-stone-400 uppercase tracking-wide mb-0.5">Hora</p>
                  <p className="font-semibold text-stone-900">{pase.hora} hrs</p>
                  <p className="text-xs text-stone-500 capitalize">
                    {pase.dia === 'sabado' ? 'Sábado' : 'Domingo'}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs text-stone-400 uppercase tracking-wide mb-0.5">Fecha</p>
                <p className="font-semibold text-stone-900 text-sm">{formatFechaLarga(pase.fechaExamen)}</p>
              </div>
            </div>

            {/* Sede */}
            <div className="flex items-start gap-2">
              <div className="bg-[var(--color-guinda-700)] text-white rounded-lg p-2 flex-shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-stone-400 uppercase tracking-wide mb-0.5">Sede</p>
                <p className="font-semibold text-stone-900">{pase.sede.nombre}</p>
                <p className="text-sm text-stone-600">{pase.sede.direccion}</p>
                {pase.sede.telefono && (
                  <p className="text-xs text-stone-500 mt-0.5">Tel: {pase.sede.telefono}</p>
                )}
              </div>
            </div>

            {/* QR Code */}
            <div className="flex flex-col items-center pt-2 border-t border-stone-100">
              <p className="text-xs text-stone-400 mb-3">Código QR — presentar en sede</p>
              <QRCodeSVG
                value={pase.qrPayload}
                size={140}
                fgColor="#7B1E3A"
                bgColor="#FFFFFF"
              />
              <p className="text-xs font-mono text-stone-400 mt-2">{pase.folio}</p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleDescargarPDF}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-[var(--color-guinda-700)] text-white text-sm font-semibold rounded-xl hover:bg-[var(--color-guinda-800)] transition-colors"
          >
            <Download className="w-4 h-4" />
            Descargar PDF
          </button>
          <button
            onClick={() => setShowPrint(true)}
            className="flex items-center justify-center gap-2 px-4 py-3 border border-[var(--color-guinda-700)] text-[var(--color-guinda-700)] text-sm font-semibold rounded-xl hover:bg-[var(--color-crema-100)] transition-colors"
          >
            <Printer className="w-4 h-4" />
            Imprimir pase
          </button>
        </div>

        {/* Ver cómo llegar */}
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full px-4 py-3 border border-stone-200 text-stone-700 text-sm font-medium rounded-xl hover:bg-stone-50 transition-colors"
        >
          <MapPin className="w-4 h-4 text-stone-500" />
          Ver cómo llegar
        </a>

        {/* Checklist si validado */}
        {pase.estado === 'pase_validado' && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="font-semibold text-green-800 text-sm mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Todo listo para tu examen
            </p>
            <ul className="space-y-1 text-sm text-green-700">
              <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5" />Pase de examen validado</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5" />Lleva identificación oficial (INE/CURP)</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5" />Llega 15 minutos antes de tu horario</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5" />Lleva pluma de tinta azul o negra</li>
            </ul>
          </div>
        )}

        {/* Aviso si inscrito o descargado */}
        {(pase.estado === 'inscrito' || pase.estado === 'pase_descargado') && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="font-semibold text-amber-800 text-sm mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Qué llevar el día del examen
            </p>
            <ul className="space-y-1 text-sm text-amber-700">
              <li>• Este pase de examen (digital o impreso)</li>
              <li>• Identificación oficial (INE o comprobante CURP)</li>
              <li>• Llegar 15 minutos antes</li>
              <li>• Pluma de tinta azul o negra</li>
            </ul>
          </div>
        )}
      </div>

      {/* Print Modal */}
      {showPrint && <PrintModal pase={pase} onClose={() => setShowPrint(false)} />}
    </EstudianteLayout>
  );
}
