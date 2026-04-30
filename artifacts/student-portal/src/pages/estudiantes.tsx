import { useState } from "react";
import { useListStudents, getListStudentsQueryKey, useCreateStudent } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Users, Plus, Search, GraduationCap, Mail } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";

const getStatusColor = (status: string) => {
  switch (status) {
    case "active": return "bg-green-100 text-green-800 border-green-200";
    case "inactive": return "bg-gray-100 text-gray-800 border-gray-200";
    case "graduated": return "bg-blue-100 text-blue-800 border-blue-200";
    default: return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case "active": return "Activo";
    case "inactive": return "Inactivo";
    case "graduated": return "Egresado";
    default: return status;
  }
};

const PROGRAMS = [
  "Ingeniería en Sistemas Computacionales",
  "Ingeniería Industrial",
  "Ingeniería Biomédica",
  "Ingeniería Civil",
  "Ingeniería Química",
  "Administración de Empresas",
  "Contaduría Pública",
  "Derecho",
  "Medicina",
  "Psicología",
];

const CAMPUSES = ["Monterrey", "Guadalajara", "Ciudad de México", "Puebla", "Estado de México", "Querétaro", "León", "San Luis Potosí"];

const createStudentSchema = z.object({
  matricula: z.string().min(8, "Matrícula debe tener al menos 8 caracteres"),
  firstName: z.string().min(2, "Nombre requerido"),
  lastName: z.string().min(2, "Apellidos requeridos"),
  email: z.string().email("Email inválido"),
  program: z.string().min(1, "Programa requerido"),
  semester: z.coerce.number().min(1).max(12, "Semestre inválido"),
  campus: z.string().min(1, "Campus requerido"),
});

type CreateStudentForm = z.infer<typeof createStudentSchema>;

export default function Estudiantes() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: students, isLoading, error } = useListStudents({
    query: { queryKey: getListStudentsQueryKey() }
  });

  const createStudent = useCreateStudent();

  const form = useForm<CreateStudentForm>({
    resolver: zodResolver(createStudentSchema),
    defaultValues: {
      matricula: "",
      firstName: "",
      lastName: "",
      email: "",
      program: "",
      semester: 1,
      campus: "",
    },
  });

  const onSubmit = (data: CreateStudentForm) => {
    createStudent.mutate(
      { data },
      {
        onSuccess: () => {
          toast({ title: "Estudiante registrado", description: "El estudiante se ha registrado exitosamente." });
          queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          setOpen(false);
          form.reset();
        },
        onError: () => {
          toast({ title: "Error", description: "No se pudo registrar el estudiante. La matrícula o email puede estar en uso.", variant: "destructive" });
        },
      }
    );
  };

  const filtered = students?.filter(s =>
    !search ||
    s.firstName.toLowerCase().includes(search.toLowerCase()) ||
    s.lastName.toLowerCase().includes(search.toLowerCase()) ||
    s.matricula.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Error al cargar estudiantes</h2>
        <p className="text-gray-600">Por favor, intente recargar la página.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Estudiantes</h1>
          <p className="text-muted-foreground mt-1">Directorio de alumnos inscritos</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#2672EC] hover:bg-[#1f5dc2] shrink-0" data-testid="button-open-create-student">
              <Plus className="mr-2 h-4 w-4" />
              Agregar Estudiante
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Registrar Estudiante</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="firstName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre(s)</FormLabel>
                      <FormControl><Input placeholder="María" {...field} data-testid="input-first-name" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="lastName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Apellidos</FormLabel>
                      <FormControl><Input placeholder="González López" {...field} data-testid="input-last-name" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="matricula" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Matrícula</FormLabel>
                    <FormControl><Input placeholder="A01234567" {...field} data-testid="input-matricula" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Correo Institucional</FormLabel>
                    <FormControl><Input type="email" placeholder="nombre@tec.mx" {...field} data-testid="input-email" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="program" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Programa</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger data-testid="select-program"><SelectValue placeholder="Seleccionar programa..." /></SelectTrigger></FormControl>
                      <SelectContent>
                        {PROGRAMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="semester" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Semestre</FormLabel>
                      <FormControl><Input type="number" min={1} max={12} {...field} data-testid="input-semester" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="campus" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Campus</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger data-testid="select-campus"><SelectValue placeholder="Campus..." /></SelectTrigger></FormControl>
                        <SelectContent>
                          {CAMPUSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <Button type="submit" className="w-full bg-[#2672EC] hover:bg-[#1f5dc2]" disabled={createStudent.isPending} data-testid="button-submit-student">
                  {createStudent.isPending ? "Registrando..." : "Registrar Estudiante"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Buscar por nombre, matrícula o correo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search-students"
        />
      </div>

      <Card>
        <CardHeader className="border-b border-gray-100 bg-gray-50/50">
          <CardTitle>Directorio de Estudiantes</CardTitle>
          <CardDescription>
            {isLoading ? "Cargando..." : `${filtered.length} estudiante(s) encontrado(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="divide-y">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="p-5 flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No se encontraron estudiantes</p>
              <p className="text-sm mt-1">{search ? "Intente cambiar los términos de búsqueda" : "Agregue el primer estudiante"}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filtered.map(student => (
                <div key={student.id} className="p-5 flex items-start gap-4" data-testid={`student-row-${student.id}`}>
                  <div className="h-12 w-12 rounded-full bg-[#2672EC] flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {student.firstName[0]}{student.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <p className="font-semibold text-gray-900">{student.firstName} {student.lastName}</p>
                        <p className="text-sm text-gray-500 font-mono mt-0.5">{student.matricula}</p>
                      </div>
                      <Badge variant="outline" className={`${getStatusColor(student.status)} shrink-0`}>
                        {getStatusLabel(student.status)}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{student.email}</span>
                      <span className="flex items-center gap-1"><GraduationCap className="h-3 w-3" />{student.program}</span>
                      <span>Semestre {student.semester} • {student.campus}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
