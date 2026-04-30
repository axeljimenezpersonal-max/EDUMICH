import { useState } from "react";
import { useListCourses, getListCoursesQueryKey, useCreateCourse } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AlertCircle, BookOpen, Plus, Search, Clock, MapPin, User } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";

const createCourseSchema = z.object({
  code: z.string().min(2, "Código requerido"),
  name: z.string().min(3, "Nombre requerido"),
  professor: z.string().min(3, "Profesor requerido"),
  credits: z.coerce.number().min(1).max(10, "Créditos inválidos"),
  schedule: z.string().min(3, "Horario requerido"),
  room: z.string().min(1, "Aula requerida"),
  semester: z.string().min(3, "Semestre requerido"),
});

type CreateCourseForm = z.infer<typeof createCourseSchema>;

export default function Cursos() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: courses, isLoading, error } = useListCourses({
    query: { queryKey: getListCoursesQueryKey() }
  });

  const createCourse = useCreateCourse();

  const form = useForm<CreateCourseForm>({
    resolver: zodResolver(createCourseSchema),
    defaultValues: {
      code: "",
      name: "",
      professor: "",
      credits: 4,
      schedule: "",
      room: "",
      semester: "Ago-Dic 2025",
    },
  });

  const onSubmit = (data: CreateCourseForm) => {
    createCourse.mutate(
      { data },
      {
        onSuccess: () => {
          toast({ title: "Curso creado", description: "El curso se ha registrado exitosamente." });
          queryClient.invalidateQueries({ queryKey: getListCoursesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          setOpen(false);
          form.reset();
        },
        onError: () => {
          toast({ title: "Error", description: "No se pudo crear el curso. El código puede estar en uso.", variant: "destructive" });
        },
      }
    );
  };

  const filtered = courses?.filter(c =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase()) ||
    c.professor.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Error al cargar cursos</h2>
        <p className="text-gray-600">Por favor, intente recargar la página.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Cursos</h1>
          <p className="text-muted-foreground mt-1">Oferta académica del semestre</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#2672EC] hover:bg-[#1f5dc2] shrink-0" data-testid="button-open-create-course">
              <Plus className="mr-2 h-4 w-4" />
              Agregar Curso
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Registrar Curso</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="code" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Clave</FormLabel>
                      <FormControl><Input placeholder="TC1028" {...field} data-testid="input-course-code" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="credits" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Créditos</FormLabel>
                      <FormControl><Input type="number" min={1} max={10} {...field} data-testid="input-credits" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del Curso</FormLabel>
                    <FormControl><Input placeholder="Programación Orientada a Objetos" {...field} data-testid="input-course-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="professor" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Profesor</FormLabel>
                    <FormControl><Input placeholder="Dr. Roberto Flores" {...field} data-testid="input-professor" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="schedule" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Horario</FormLabel>
                    <FormControl><Input placeholder="Lun-Mié-Vie 8:00-9:00" {...field} data-testid="input-schedule" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="room" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Aula</FormLabel>
                      <FormControl><Input placeholder="CIIT 302" {...field} data-testid="input-room" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="semester" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Semestre</FormLabel>
                      <FormControl><Input placeholder="Ago-Dic 2025" {...field} data-testid="input-semester-period" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <Button type="submit" className="w-full bg-[#2672EC] hover:bg-[#1f5dc2]" disabled={createCourse.isPending} data-testid="button-submit-course">
                  {createCourse.isPending ? "Registrando..." : "Registrar Curso"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Buscar por nombre, clave o profesor..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search-courses"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-gray-500">
            <BookOpen className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No se encontraron cursos</p>
            <p className="text-sm mt-1">{search ? "Intente cambiar los términos de búsqueda" : "Agregue el primer curso"}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map(course => (
            <Card key={course.id} className="hover:shadow-md transition-shadow" data-testid={`course-card-${course.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Badge variant="outline" className="mb-2 font-mono text-xs text-[#2672EC] border-[#2672EC]/30 bg-blue-50">
                      {course.code}
                    </Badge>
                    <CardTitle className="text-base leading-tight">{course.name}</CardTitle>
                  </div>
                  <Badge variant="outline" className="text-gray-600 shrink-0">
                    {course.credits} cr.
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <User className="h-3.5 w-3.5 text-gray-400" />
                  <span>{course.professor}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="h-3.5 w-3.5 text-gray-400" />
                  <span>{course.schedule}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin className="h-3.5 w-3.5 text-gray-400" />
                  <span>{course.room}</span>
                </div>
                <div className="pt-1">
                  <Badge variant="outline" className="text-xs text-gray-500">{course.semester}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
