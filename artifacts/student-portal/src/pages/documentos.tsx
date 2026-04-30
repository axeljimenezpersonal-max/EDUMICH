import { useState } from "react";
import { useListDocuments, getListDocumentsQueryKey, useCreateDocument, useDeleteDocument } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, FileText, Plus, Trash2, Upload } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";

const getStatusColor = (status: string) => {
  switch (status) {
    case "pending": return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "approved": return "bg-green-100 text-green-800 border-green-200";
    case "rejected": return "bg-red-100 text-red-800 border-red-200";
    default: return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case "pending": return "Pendiente";
    case "approved": return "Aprobado";
    case "rejected": return "Rechazado";
    default: return status;
  }
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const createDocumentSchema = z.object({
  studentId: z.coerce.number().min(1, "ID de estudiante requerido"),
  studentName: z.string().min(2, "Nombre requerido"),
  fileName: z.string().min(1, "Nombre de archivo requerido"),
  fileType: z.string().min(1, "Tipo de archivo requerido"),
  fileSize: z.coerce.number().min(1, "Tamaño requerido"),
  documentType: z.string().min(1, "Tipo de documento requerido"),
  description: z.string().optional(),
});

type CreateDocumentForm = z.infer<typeof createDocumentSchema>;

const DOCUMENT_TYPES = [
  "Constancia de Estudios",
  "Comprobante de Pago",
  "Solicitud de Titulación",
  "Certificado Médico",
  "Carta de Recomendación",
  "Historial Académico",
  "Comprobante de Inscripción",
  "Otro",
];

export default function Documentos() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: documents, isLoading, error } = useListDocuments(
    {},
    { query: { queryKey: getListDocumentsQueryKey({}) } }
  );

  const createDocument = useCreateDocument();
  const deleteDocument = useDeleteDocument();

  const form = useForm<CreateDocumentForm>({
    resolver: zodResolver(createDocumentSchema),
    defaultValues: {
      studentId: 1,
      studentName: "",
      fileName: "",
      fileType: "application/pdf",
      fileSize: 100000,
      documentType: "",
      description: "",
    },
  });

  const onSubmit = (data: CreateDocumentForm) => {
    createDocument.mutate(
      { data },
      {
        onSuccess: () => {
          toast({ title: "Documento registrado", description: "El documento se ha registrado exitosamente." });
          queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey({}) });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          setOpen(false);
          form.reset();
        },
        onError: () => {
          toast({ title: "Error", description: "No se pudo registrar el documento.", variant: "destructive" });
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteDocument.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Documento eliminado", description: "El documento se ha eliminado." });
          queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey({}) });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        },
        onError: () => {
          toast({ title: "Error", description: "No se pudo eliminar el documento.", variant: "destructive" });
        },
      }
    );
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Error al cargar documentos</h2>
        <p className="text-gray-600">Por favor, intente recargar la página.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Documentos</h1>
          <p className="text-muted-foreground mt-1">Gestiona los trámites y documentos escolares</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#2672EC] hover:bg-[#1f5dc2] shrink-0" data-testid="button-open-create-document">
              <Plus className="mr-2 h-4 w-4" />
              Registrar Documento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Registrar Documento</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="studentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ID Estudiante</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="1" {...field} data-testid="input-student-id" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="studentName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre del Estudiante</FormLabel>
                        <FormControl>
                          <Input placeholder="María González" {...field} data-testid="input-student-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="documentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Documento</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-document-type">
                            <SelectValue placeholder="Seleccionar tipo..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DOCUMENT_TYPES.map(t => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fileName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del Archivo</FormLabel>
                      <FormControl>
                        <Input placeholder="documento.pdf" {...field} data-testid="input-file-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="fileType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo MIME</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-file-type">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="application/pdf">PDF</SelectItem>
                            <SelectItem value="image/jpeg">JPEG</SelectItem>
                            <SelectItem value="image/png">PNG</SelectItem>
                            <SelectItem value="application/vnd.openxmlformats-officedocument.wordprocessingml.document">Word</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fileSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tamaño (bytes)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="100000" {...field} data-testid="input-file-size" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción (opcional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Descripción del documento..." {...field} data-testid="textarea-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full bg-[#2672EC] hover:bg-[#1f5dc2]"
                  disabled={createDocument.isPending}
                  data-testid="button-submit-document"
                >
                  {createDocument.isPending ? (
                    <span>Registrando...</span>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Registrar Documento
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="border-b border-gray-100 bg-gray-50/50">
          <CardTitle>Documentos Registrados</CardTitle>
          <CardDescription>
            {isLoading ? "Cargando..." : `${documents?.length ?? 0} documentos en total`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="divide-y">
              {[1, 2, 3].map(i => (
                <div key={i} className="p-5 flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : documents?.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No hay documentos registrados</p>
              <p className="text-sm mt-1">Haga clic en "Registrar Documento" para agregar el primero</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {documents?.map(doc => (
                <div key={doc.id} className="p-5 flex items-start gap-4" data-testid={`document-row-${doc.id}`}>
                  <div className="h-12 w-12 rounded bg-blue-50 flex items-center justify-center text-[#2672EC] shrink-0">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-gray-900">{doc.fileName}</p>
                        <p className="text-sm text-gray-600 mt-0.5">{doc.documentType}</p>
                      </div>
                      <Badge variant="outline" className={`${getStatusColor(doc.status)} shrink-0`}>
                        {getStatusLabel(doc.status)}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                      <span>Estudiante: <span className="font-medium text-gray-700">{doc.studentName}</span></span>
                      <span>Tamaño: {formatFileSize(doc.fileSize)}</span>
                      <span>Fecha: {new Date(doc.createdAt).toLocaleDateString("es-MX")}</span>
                    </div>
                    {doc.description && (
                      <p className="text-xs text-gray-500 mt-1 italic">{doc.description}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-gray-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                    onClick={() => handleDelete(doc.id)}
                    disabled={deleteDocument.isPending}
                    data-testid={`button-delete-document-${doc.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
