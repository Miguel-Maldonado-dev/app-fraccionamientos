export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      anios: {
        Row: {
          anio: number
          created_at: string
          id: number
        }
        Insert: {
          anio: number
          created_at?: string
          id?: number
        }
        Update: {
          anio?: number
          created_at?: string
          id?: number
        }
        Relationships: []
      }
      concepto_pago_acceso: {
        Row: {
          concepto_pago_id: number
          created_at: string
          fraccionamiento_id: number
          id: number
          medios: Database["public"]["Enums"]["medio_acceso"][]
          perfil_corriente_id: string | null
          perfil_corriente_nombre: string | null
          perfil_moroso_id: string | null
          perfil_moroso_nombre: string | null
        }
        Insert: {
          concepto_pago_id: number
          created_at?: string
          fraccionamiento_id?: number
          id?: number
          medios?: Database["public"]["Enums"]["medio_acceso"][]
          perfil_corriente_id?: string | null
          perfil_corriente_nombre?: string | null
          perfil_moroso_id?: string | null
          perfil_moroso_nombre?: string | null
        }
        Update: {
          concepto_pago_id?: number
          created_at?: string
          fraccionamiento_id?: number
          id?: number
          medios?: Database["public"]["Enums"]["medio_acceso"][]
          perfil_corriente_id?: string | null
          perfil_corriente_nombre?: string | null
          perfil_moroso_id?: string | null
          perfil_moroso_nombre?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "concepto_pago_acceso_concepto_pago_id_fkey"
            columns: ["concepto_pago_id", "fraccionamiento_id"]
            isOneToOne: false
            referencedRelation: "conceptos_pago"
            referencedColumns: ["id", "fraccionamiento_id"]
          },
          {
            foreignKeyName: "concepto_pago_acceso_fraccionamiento_id_fkey"
            columns: ["fraccionamiento_id"]
            isOneToOne: false
            referencedRelation: "fraccionamientos"
            referencedColumns: ["id"]
          },
        ]
      }
      conceptos_descuento: {
        Row: {
          created_at: string
          fraccionamiento_id: number
          id: number
          monto_descuento: number
          nombre: string
        }
        Insert: {
          created_at?: string
          fraccionamiento_id?: number
          id?: number
          monto_descuento: number
          nombre: string
        }
        Update: {
          created_at?: string
          fraccionamiento_id?: number
          id?: number
          monto_descuento?: number
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "conceptos_descuento_fraccionamiento_id_fkey"
            columns: ["fraccionamiento_id"]
            isOneToOne: false
            referencedRelation: "fraccionamientos"
            referencedColumns: ["id"]
          },
        ]
      }
      conceptos_pago: {
        Row: {
          created_at: string
          fraccionamiento_id: number
          id: number
          importe: number
          nombre: string
          tipo_pago_id: number
        }
        Insert: {
          created_at?: string
          fraccionamiento_id?: number
          id?: number
          importe: number
          nombre: string
          tipo_pago_id: number
        }
        Update: {
          created_at?: string
          fraccionamiento_id?: number
          id?: number
          importe?: number
          nombre?: string
          tipo_pago_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "conceptos_pago_fraccionamiento_id_fkey"
            columns: ["fraccionamiento_id"]
            isOneToOne: false
            referencedRelation: "fraccionamientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conceptos_pago_tipo_pago_id_fkey"
            columns: ["tipo_pago_id"]
            isOneToOne: false
            referencedRelation: "tipo_pago"
            referencedColumns: ["id"]
          },
        ]
      }
      conceptos_recargo: {
        Row: {
          created_at: string
          fraccionamiento_id: number
          id: number
          monto_recargo: number
          nombre: string
        }
        Insert: {
          created_at?: string
          fraccionamiento_id?: number
          id?: number
          monto_recargo: number
          nombre: string
        }
        Update: {
          created_at?: string
          fraccionamiento_id?: number
          id?: number
          monto_recargo?: number
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "conceptos_recargo_fraccionamiento_id_fkey"
            columns: ["fraccionamiento_id"]
            isOneToOne: false
            referencedRelation: "fraccionamientos"
            referencedColumns: ["id"]
          },
        ]
      }
      controles_acceso: {
        Row: {
          botones: Json
          control_id: string | null
          created_at: string
          descripcion: string | null
          domicilio_id: number
          fraccionamiento_id: number
          id: number
        }
        Insert: {
          botones: Json
          control_id?: string | null
          created_at?: string
          descripcion?: string | null
          domicilio_id: number
          fraccionamiento_id?: number
          id?: number
        }
        Update: {
          botones?: Json
          control_id?: string | null
          created_at?: string
          descripcion?: string | null
          domicilio_id?: number
          fraccionamiento_id?: number
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "controles_acceso_domicilio_id_fkey"
            columns: ["domicilio_id", "fraccionamiento_id"]
            isOneToOne: false
            referencedRelation: "domicilios"
            referencedColumns: ["id", "fraccionamiento_id"]
          },
          {
            foreignKeyName: "controles_acceso_fraccionamiento_id_fkey"
            columns: ["fraccionamiento_id"]
            isOneToOne: false
            referencedRelation: "fraccionamientos"
            referencedColumns: ["id"]
          },
        ]
      }
      cuotas: {
        Row: {
          anio: number
          concepto_id: number
          created_at: string
          domicilio_id: number
          estatus_id: number
          fecha_vencimiento: string
          fraccionamiento_id: number
          id: number
          importe: number
          mes: number
        }
        Insert: {
          anio: number
          concepto_id: number
          created_at?: string
          domicilio_id: number
          estatus_id: number
          fecha_vencimiento: string
          fraccionamiento_id?: number
          id?: number
          importe: number
          mes: number
        }
        Update: {
          anio?: number
          concepto_id?: number
          created_at?: string
          domicilio_id?: number
          estatus_id?: number
          fecha_vencimiento?: string
          fraccionamiento_id?: number
          id?: number
          importe?: number
          mes?: number
        }
        Relationships: [
          {
            foreignKeyName: "cuotas_concepto_id_fkey"
            columns: ["concepto_id", "fraccionamiento_id"]
            isOneToOne: false
            referencedRelation: "conceptos_pago"
            referencedColumns: ["id", "fraccionamiento_id"]
          },
          {
            foreignKeyName: "cuotas_domicilio_id_fkey"
            columns: ["domicilio_id", "fraccionamiento_id"]
            isOneToOne: false
            referencedRelation: "domicilios"
            referencedColumns: ["id", "fraccionamiento_id"]
          },
          {
            foreignKeyName: "cuotas_estatus_id_fkey"
            columns: ["estatus_id"]
            isOneToOne: false
            referencedRelation: "estatus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cuotas_fraccionamiento_id_fkey"
            columns: ["fraccionamiento_id"]
            isOneToOne: false
            referencedRelation: "fraccionamientos"
            referencedColumns: ["id"]
          },
        ]
      }
      descuento_cuota: {
        Row: {
          concepto_descuento_id: number
          created_at: string
          cuota_id: number
          fraccionamiento_id: number
          id: number
        }
        Insert: {
          concepto_descuento_id: number
          created_at?: string
          cuota_id: number
          fraccionamiento_id?: number
          id?: number
        }
        Update: {
          concepto_descuento_id?: number
          created_at?: string
          cuota_id?: number
          fraccionamiento_id?: number
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "descuento_cuota_concepto_descuento_id_fkey"
            columns: ["concepto_descuento_id", "fraccionamiento_id"]
            isOneToOne: false
            referencedRelation: "conceptos_descuento"
            referencedColumns: ["id", "fraccionamiento_id"]
          },
          {
            foreignKeyName: "descuento_cuota_cuota_id_fkey"
            columns: ["cuota_id", "fraccionamiento_id"]
            isOneToOne: false
            referencedRelation: "cuotas"
            referencedColumns: ["id", "fraccionamiento_id"]
          },
          {
            foreignKeyName: "descuento_cuota_fraccionamiento_id_fkey"
            columns: ["fraccionamiento_id"]
            isOneToOne: false
            referencedRelation: "fraccionamientos"
            referencedColumns: ["id"]
          },
        ]
      }
      domicilio_concepto: {
        Row: {
          concepto_id: number
          created_at: string
          domicilio_id: number
          fraccionamiento_id: number
          id: number
        }
        Insert: {
          concepto_id: number
          created_at?: string
          domicilio_id: number
          fraccionamiento_id?: number
          id?: number
        }
        Update: {
          concepto_id?: number
          created_at?: string
          domicilio_id?: number
          fraccionamiento_id?: number
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "domicilio_concepto_concepto_id_fkey"
            columns: ["concepto_id", "fraccionamiento_id"]
            isOneToOne: false
            referencedRelation: "conceptos_pago"
            referencedColumns: ["id", "fraccionamiento_id"]
          },
          {
            foreignKeyName: "domicilio_concepto_domicilio_id_fkey"
            columns: ["domicilio_id", "fraccionamiento_id"]
            isOneToOne: false
            referencedRelation: "domicilios"
            referencedColumns: ["id", "fraccionamiento_id"]
          },
          {
            foreignKeyName: "domicilio_concepto_fraccionamiento_id_fkey"
            columns: ["fraccionamiento_id"]
            isOneToOne: false
            referencedRelation: "fraccionamientos"
            referencedColumns: ["id"]
          },
        ]
      }
      domicilios: {
        Row: {
          acceso_forzado: string | null
          acceso_forzado_en: string | null
          acceso_forzado_por: string | null
          created_at: string
          created_by: string
          direccion: string
          fecha_alta: string
          fraccionamiento_id: number
          id: number
          observaciones: string | null
          perfil_asignado_id: string | null
          titular_id: string | null
        }
        Insert: {
          acceso_forzado?: string | null
          acceso_forzado_en?: string | null
          acceso_forzado_por?: string | null
          created_at?: string
          created_by: string
          direccion: string
          fecha_alta: string
          fraccionamiento_id?: number
          id?: number
          observaciones?: string | null
          perfil_asignado_id?: string | null
          titular_id?: string | null
        }
        Update: {
          acceso_forzado?: string | null
          acceso_forzado_en?: string | null
          acceso_forzado_por?: string | null
          created_at?: string
          created_by?: string
          direccion?: string
          fecha_alta?: string
          fraccionamiento_id?: number
          id?: number
          observaciones?: string | null
          perfil_asignado_id?: string | null
          titular_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "domicilios_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "domicilios_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "domicilios_fraccionamiento_id_fkey"
            columns: ["fraccionamiento_id"]
            isOneToOne: false
            referencedRelation: "fraccionamientos"
            referencedColumns: ["id"]
          },
        ]
      }
      estatus: {
        Row: {
          created_at: string
          id: number
          name: string
        }
        Insert: {
          created_at?: string
          id?: number
          name: string
        }
        Update: {
          created_at?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      fraccionamiento_botones: {
        Row: {
          boton: number
          fraccionamiento_id: number
          panel_codigo: string
          panel_id: string
          salida: number
          salida_alias: string | null
        }
        Insert: {
          boton: number
          fraccionamiento_id: number
          panel_codigo: string
          panel_id: string
          salida: number
          salida_alias?: string | null
        }
        Update: {
          boton?: number
          fraccionamiento_id?: number
          panel_codigo?: string
          panel_id?: string
          salida?: number
          salida_alias?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fraccionamiento_botones_fraccionamiento_id_fkey"
            columns: ["fraccionamiento_id"]
            isOneToOne: false
            referencedRelation: "fraccionamientos"
            referencedColumns: ["id"]
          },
        ]
      }
      fraccionamiento_medios: {
        Row: {
          fraccionamiento_id: number
          medio: Database["public"]["Enums"]["medio_acceso"]
        }
        Insert: {
          fraccionamiento_id: number
          medio: Database["public"]["Enums"]["medio_acceso"]
        }
        Update: {
          fraccionamiento_id?: number
          medio?: Database["public"]["Enums"]["medio_acceso"]
        }
        Relationships: [
          {
            foreignKeyName: "fraccionamiento_medios_fraccionamiento_id_fkey"
            columns: ["fraccionamiento_id"]
            isOneToOne: false
            referencedRelation: "fraccionamientos"
            referencedColumns: ["id"]
          },
        ]
      }
      fraccionamientos: {
        Row: {
          activo: boolean
          created_at: string
          id: number
          instalacion_id: string | null
          instalacion_nombre: string | null
          nombre: string
          slug: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id?: number
          instalacion_id?: string | null
          instalacion_nombre?: string | null
          nombre: string
          slug: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: number
          instalacion_id?: string | null
          instalacion_nombre?: string | null
          nombre?: string
          slug?: string
        }
        Relationships: []
      }
      meses: {
        Row: {
          created_at: string
          id: number
          name: string
        }
        Insert: {
          created_at?: string
          id?: number
          name: string
        }
        Update: {
          created_at?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      metodos_pago: {
        Row: {
          created_at: string
          id: number
          name: string
        }
        Insert: {
          created_at?: string
          id?: number
          name: string
        }
        Update: {
          created_at?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      movimientos_financieros: {
        Row: {
          created_at: string
          descripcion: string
          fecha_movimiento: string
          fraccionamiento_id: number
          id: number
          importe: number
          metodo_pago_id: number
          referencia: string
          tipo_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          descripcion: string
          fecha_movimiento: string
          fraccionamiento_id?: number
          id?: number
          importe: number
          metodo_pago_id: number
          referencia?: string
          tipo_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          descripcion?: string
          fecha_movimiento?: string
          fraccionamiento_id?: number
          id?: number
          importe?: number
          metodo_pago_id?: number
          referencia?: string
          tipo_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_financieros_fraccionamiento_id_fkey"
            columns: ["fraccionamiento_id"]
            isOneToOne: false
            referencedRelation: "fraccionamientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_financieros_metodo_pago_id_fkey"
            columns: ["metodo_pago_id"]
            isOneToOne: false
            referencedRelation: "metodos_pago"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_financieros_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "tipos_movimientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_financieros_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_financieros_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_info"
            referencedColumns: ["id"]
          },
        ]
      }
      pagos: {
        Row: {
          concepto_id: number | null
          created_at: string
          cuota_id: number | null
          domicilio_id: number
          fecha_pago: string
          fraccionamiento_id: number
          id: number
          importe: number
          metodo_pago_id: number
          recibo: Json | null
          referencia: string
          user_id: string
        }
        Insert: {
          concepto_id?: number | null
          created_at?: string
          cuota_id?: number | null
          domicilio_id: number
          fecha_pago: string
          fraccionamiento_id?: number
          id?: number
          importe: number
          metodo_pago_id: number
          recibo?: Json | null
          referencia?: string
          user_id: string
        }
        Update: {
          concepto_id?: number | null
          created_at?: string
          cuota_id?: number | null
          domicilio_id?: number
          fecha_pago?: string
          fraccionamiento_id?: number
          id?: number
          importe?: number
          metodo_pago_id?: number
          recibo?: Json | null
          referencia?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagos_concepto_id_fkey"
            columns: ["concepto_id", "fraccionamiento_id"]
            isOneToOne: false
            referencedRelation: "conceptos_pago"
            referencedColumns: ["id", "fraccionamiento_id"]
          },
          {
            foreignKeyName: "pagos_cuota_id_fkey"
            columns: ["cuota_id", "fraccionamiento_id"]
            isOneToOne: false
            referencedRelation: "cuotas"
            referencedColumns: ["id", "fraccionamiento_id"]
          },
          {
            foreignKeyName: "pagos_domicilio_id_fkey"
            columns: ["domicilio_id", "fraccionamiento_id"]
            isOneToOne: false
            referencedRelation: "domicilios"
            referencedColumns: ["id", "fraccionamiento_id"]
          },
          {
            foreignKeyName: "pagos_fraccionamiento_id_fkey"
            columns: ["fraccionamiento_id"]
            isOneToOne: false
            referencedRelation: "fraccionamientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_metodo_pago_id_fkey"
            columns: ["metodo_pago_id"]
            isOneToOne: false
            referencedRelation: "metodos_pago"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_info"
            referencedColumns: ["id"]
          },
        ]
      }
      perfiles: {
        Row: {
          activo: boolean
          created_at: string
          email: string
          fraccionamiento_id: number | null
          id: string
          nombre: string
          rol: Database["public"]["Enums"]["rol_usuario"]
        }
        Insert: {
          activo?: boolean
          created_at?: string
          email: string
          fraccionamiento_id?: number | null
          id: string
          nombre: string
          rol: Database["public"]["Enums"]["rol_usuario"]
        }
        Update: {
          activo?: boolean
          created_at?: string
          email?: string
          fraccionamiento_id?: number | null
          id?: string
          nombre?: string
          rol?: Database["public"]["Enums"]["rol_usuario"]
        }
        Relationships: [
          {
            foreignKeyName: "perfiles_fraccionamiento_id_fkey"
            columns: ["fraccionamiento_id"]
            isOneToOne: false
            referencedRelation: "fraccionamientos"
            referencedColumns: ["id"]
          },
        ]
      }
      pines_acceso: {
        Row: {
          actualizado_at: string
          domicilio_id: number
          fraccionamiento_id: number
          pin: string
        }
        Insert: {
          actualizado_at?: string
          domicilio_id: number
          fraccionamiento_id?: number
          pin: string
        }
        Update: {
          actualizado_at?: string
          domicilio_id?: number
          fraccionamiento_id?: number
          pin?: string
        }
        Relationships: [
          {
            foreignKeyName: "pines_acceso_domicilio_id_fkey"
            columns: ["domicilio_id", "fraccionamiento_id"]
            isOneToOne: false
            referencedRelation: "domicilios"
            referencedColumns: ["id", "fraccionamiento_id"]
          },
          {
            foreignKeyName: "pines_acceso_fraccionamiento_id_fkey"
            columns: ["fraccionamiento_id"]
            isOneToOne: false
            referencedRelation: "fraccionamientos"
            referencedColumns: ["id"]
          },
        ]
      }
      recargo_cuota: {
        Row: {
          concepto_recargo_id: number
          created_at: string
          cuota_id: number
          fraccionamiento_id: number
          id: number
        }
        Insert: {
          concepto_recargo_id: number
          created_at?: string
          cuota_id: number
          fraccionamiento_id?: number
          id?: number
        }
        Update: {
          concepto_recargo_id?: number
          created_at?: string
          cuota_id?: number
          fraccionamiento_id?: number
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "recargo_cuota_concepto_recargo_id_fkey"
            columns: ["concepto_recargo_id", "fraccionamiento_id"]
            isOneToOne: false
            referencedRelation: "conceptos_recargo"
            referencedColumns: ["id", "fraccionamiento_id"]
          },
          {
            foreignKeyName: "recargo_cuota_cuota_id_fkey"
            columns: ["cuota_id", "fraccionamiento_id"]
            isOneToOne: false
            referencedRelation: "cuotas"
            referencedColumns: ["id", "fraccionamiento_id"]
          },
          {
            foreignKeyName: "recargo_cuota_fraccionamiento_id_fkey"
            columns: ["fraccionamiento_id"]
            isOneToOne: false
            referencedRelation: "fraccionamientos"
            referencedColumns: ["id"]
          },
        ]
      }
      reglas_cobro: {
        Row: {
          concepto_recargo_id: number | null
          cuotas_para_moroso: number
          dia_generacion: number | null
          dia_vencimiento: number | null
          dias_gracia: number
          fraccionamiento_id: number
          recargo_desde: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          concepto_recargo_id?: number | null
          cuotas_para_moroso?: number
          dia_generacion?: number | null
          dia_vencimiento?: number | null
          dias_gracia?: number
          fraccionamiento_id: number
          recargo_desde?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          concepto_recargo_id?: number | null
          cuotas_para_moroso?: number
          dia_generacion?: number | null
          dia_vencimiento?: number | null
          dias_gracia?: number
          fraccionamiento_id?: number
          recargo_desde?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reglas_cobro_concepto_recargo_id_fkey"
            columns: ["concepto_recargo_id", "fraccionamiento_id"]
            isOneToOne: false
            referencedRelation: "conceptos_recargo"
            referencedColumns: ["id", "fraccionamiento_id"]
          },
          {
            foreignKeyName: "reglas_cobro_fraccionamiento_id_fkey"
            columns: ["fraccionamiento_id"]
            isOneToOne: true
            referencedRelation: "fraccionamientos"
            referencedColumns: ["id"]
          },
        ]
      }
      residentes: {
        Row: {
          created_at: string
          domicilio_id: number
          es_principal: boolean | null
          fraccionamiento_id: number
          id: number
          nombre: string
          telefono: string | null
        }
        Insert: {
          created_at?: string
          domicilio_id: number
          es_principal?: boolean | null
          fraccionamiento_id?: number
          id?: number
          nombre: string
          telefono?: string | null
        }
        Update: {
          created_at?: string
          domicilio_id?: number
          es_principal?: boolean | null
          fraccionamiento_id?: number
          id?: number
          nombre?: string
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "residentes_domicilio_id_fkey"
            columns: ["domicilio_id", "fraccionamiento_id"]
            isOneToOne: false
            referencedRelation: "domicilios"
            referencedColumns: ["id", "fraccionamiento_id"]
          },
          {
            foreignKeyName: "residentes_fraccionamiento_id_fkey"
            columns: ["fraccionamiento_id"]
            isOneToOne: false
            referencedRelation: "fraccionamientos"
            referencedColumns: ["id"]
          },
        ]
      }
      sincronizacion_leases: {
        Row: {
          fraccionamiento_id: number
          hasta: string
          token: string
        }
        Insert: {
          fraccionamiento_id: number
          hasta: string
          token: string
        }
        Update: {
          fraccionamiento_id?: number
          hasta?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "sincronizacion_leases_fraccionamiento_id_fkey"
            columns: ["fraccionamiento_id"]
            isOneToOne: true
            referencedRelation: "fraccionamientos"
            referencedColumns: ["id"]
          },
        ]
      }
      sincronizaciones_acceso: {
        Row: {
          carga: Json
          created_at: string
          domicilio_id: number | null
          entidad: string
          entidad_id: number | null
          estado: string
          fraccionamiento_id: number
          id: string
          intentos: number
          operacion: string
          proximo_intento_at: string
          ultimo_error: string | null
          updated_at: string
        }
        Insert: {
          carga?: Json
          created_at?: string
          domicilio_id?: number | null
          entidad: string
          entidad_id?: number | null
          estado?: string
          fraccionamiento_id?: number
          id?: string
          intentos?: number
          operacion: string
          proximo_intento_at?: string
          ultimo_error?: string | null
          updated_at?: string
        }
        Update: {
          carga?: Json
          created_at?: string
          domicilio_id?: number | null
          entidad?: string
          entidad_id?: number | null
          estado?: string
          fraccionamiento_id?: number
          id?: string
          intentos?: number
          operacion?: string
          proximo_intento_at?: string
          ultimo_error?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sincronizaciones_acceso_fraccionamiento_id_fkey"
            columns: ["fraccionamiento_id"]
            isOneToOne: false
            referencedRelation: "fraccionamientos"
            referencedColumns: ["id"]
          },
        ]
      }
      tarjetas_acceso: {
        Row: {
          created_at: string
          descripcion: string | null
          domicilio_id: number
          fraccionamiento_id: number
          id: number
          numero: string
          tarjeta_id: string | null
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          domicilio_id: number
          fraccionamiento_id?: number
          id?: number
          numero: string
          tarjeta_id?: string | null
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          domicilio_id?: number
          fraccionamiento_id?: number
          id?: number
          numero?: string
          tarjeta_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tarjetas_acceso_domicilio_id_fkey"
            columns: ["domicilio_id", "fraccionamiento_id"]
            isOneToOne: false
            referencedRelation: "domicilios"
            referencedColumns: ["id", "fraccionamiento_id"]
          },
          {
            foreignKeyName: "tarjetas_acceso_fraccionamiento_id_fkey"
            columns: ["fraccionamiento_id"]
            isOneToOne: false
            referencedRelation: "fraccionamientos"
            referencedColumns: ["id"]
          },
        ]
      }
      telefonos_acceso: {
        Row: {
          created_at: string
          domicilio_id: number
          fraccionamiento_id: number
          id: number
          telefono: string
        }
        Insert: {
          created_at?: string
          domicilio_id: number
          fraccionamiento_id?: number
          id?: number
          telefono: string
        }
        Update: {
          created_at?: string
          domicilio_id?: number
          fraccionamiento_id?: number
          id?: number
          telefono?: string
        }
        Relationships: [
          {
            foreignKeyName: "telefonos_acceso_domicilio_id_fkey"
            columns: ["domicilio_id", "fraccionamiento_id"]
            isOneToOne: false
            referencedRelation: "domicilios"
            referencedColumns: ["id", "fraccionamiento_id"]
          },
          {
            foreignKeyName: "telefonos_acceso_fraccionamiento_id_fkey"
            columns: ["fraccionamiento_id"]
            isOneToOne: false
            referencedRelation: "fraccionamientos"
            referencedColumns: ["id"]
          },
        ]
      }
      tipo_pago: {
        Row: {
          created_at: string
          id: number
          name: string
        }
        Insert: {
          created_at?: string
          id?: number
          name: string
        }
        Update: {
          created_at?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      tipos_movimientos: {
        Row: {
          created_at: string
          id: number
          name: string
        }
        Insert: {
          created_at?: string
          id?: number
          name: string
        }
        Update: {
          created_at?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      cuotas_info: {
        Row: {
          anio: number | null
          concepto: string | null
          concepto_id: number | null
          created_at: string | null
          direccion: string | null
          domicilio_id: number | null
          estatus: string | null
          estatus_calculado: string | null
          fecha_vencimiento: string | null
          fecha_vencimiento_formated: string | null
          id: number | null
          importe_base: number | null
          importe_cuota: number | null
          mes: number | null
          monto_descuento: number | null
          monto_recargo: number | null
          periodo: string | null
          residente_principal: string | null
        }
        Relationships: []
      }
      domicilio_concepto_info: {
        Row: {
          concepto_id: number | null
          concepto_nombre: string | null
          direccion: string | null
          domicilio_id: number | null
          id: number | null
          importe: number | null
        }
        Relationships: []
      }
      domicilios_info: {
        Row: {
          direccion: string | null
          estatus: string | null
          fecha_alta: string | null
          id: number | null
          id_concepto: number | null
          medios: Database["public"]["Enums"]["medio_acceso"][] | null
          observaciones: string | null
          residente_principal: string | null
          tipo_cuota: string | null
        }
        Relationships: []
      }
      movimientos_info: {
        Row: {
          created_at: string | null
          descripcion: string | null
          fecha_movimiento: string | null
          id: number | null
          importe: number | null
          metodo_pago: string | null
          metodo_pago_id: number | null
          referencia: string | null
          tipo_id: number | null
          tipo_movimiento: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_financieros_metodo_pago_id_fkey"
            columns: ["metodo_pago_id"]
            isOneToOne: false
            referencedRelation: "metodos_pago"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_financieros_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "tipos_movimientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_financieros_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_financieros_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_info"
            referencedColumns: ["id"]
          },
        ]
      }
      pagos_info: {
        Row: {
          anio: number | null
          concepto: string | null
          concepto_id: number | null
          created_at: string | null
          cuota_id: number | null
          direccion: string | null
          domicilio_id: number | null
          fecha_pago: string | null
          id: number | null
          importe: number | null
          mes: number | null
          metodo_pago: string | null
          metodo_pago_id: number | null
          referencia: string | null
          tiene_recibo: boolean | null
          tipo_pago_id: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conceptos_pago_tipo_pago_id_fkey"
            columns: ["tipo_pago_id"]
            isOneToOne: false
            referencedRelation: "tipo_pago"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_metodo_pago_id_fkey"
            columns: ["metodo_pago_id"]
            isOneToOne: false
            referencedRelation: "metodos_pago"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_info"
            referencedColumns: ["id"]
          },
        ]
      }
      reporte_pagos_detalle: {
        Row: {
          domicilio_id: number | null
          fecha_pago: string | null
          id: number | null
          importe: number | null
          metodo_pago_id: number | null
          metodo_pago_nombre: string | null
          nombre_usuario: string | null
          referencia: string | null
          tiene_recibo: boolean | null
          user_id: string | null
          usuario: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagos_metodo_pago_id_fkey"
            columns: ["metodo_pago_id"]
            isOneToOne: false
            referencedRelation: "metodos_pago"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_info"
            referencedColumns: ["id"]
          },
        ]
      }
      residentes_info: {
        Row: {
          created_at: string | null
          direccion: string | null
          domicilio_id: number | null
          es_principal: boolean | null
          id: number | null
          nombre: string | null
          telefono: string | null
        }
        Relationships: []
      }
      resumen_financiero_completo: {
        Row: {
          egresos_mes: number | null
          egresos_mes_anterior: number | null
          ingresos_mes: number | null
          ingresos_mes_anterior: number | null
          saldo_actual: number | null
          total_egresos: number | null
          total_ingresos: number | null
        }
        Relationships: []
      }
      users_info: {
        Row: {
          created_at: string | null
          email: string | null
          fraccionamiento_id: number | null
          id: string | null
          is_active: boolean | null
          rol: Database["public"]["Enums"]["rol_usuario"] | null
          user_name: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          fraccionamiento_id?: number | null
          id?: string | null
          is_active?: boolean | null
          rol?: Database["public"]["Enums"]["rol_usuario"] | null
          user_name?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          fraccionamiento_id?: number | null
          id?: string | null
          is_active?: boolean | null
          rol?: Database["public"]["Enums"]["rol_usuario"] | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perfiles_fraccionamiento_id_fkey"
            columns: ["fraccionamiento_id"]
            isOneToOne: false
            referencedRelation: "fraccionamientos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      adquirir_sincronizacion: {
        Args: {
          p_fraccionamiento_id: number
          p_segundos?: number
          p_token: string
        }
        Returns: boolean
      }
      cancelar_sincronizaciones: {
        Args: { p_fraccionamiento_id: number }
        Returns: number
      }
      estado_acceso_domicilio: {
        Args: { p_domicilio_id: number }
        Returns: {
          acceso_forzado: string
          es_moroso: boolean
          forzado_en: string
          forzado_por_nombre: string
        }[]
      }
      forzar_acceso: {
        Args: { p_domicilio_id: number; p_valor: string }
        Returns: undefined
      }
      generar_cuota_domicilio: {
        Args: { p_anio: number; p_domicilio_id: number; p_mes: number }
        Returns: undefined
      }
      generar_cuotas: {
        Args: { p_anio: number; p_mes: number }
        Returns: undefined
      }
      liberar_sincronizacion: {
        Args: { p_fraccionamiento_id: number; p_token: string }
        Returns: undefined
      }
      perfil_deseado: { Args: { p_domicilio_id: number }; Returns: string }
      procesar_reglas_cobro: { Args: never; Returns: undefined }
      recalcular_permisos_acceso: {
        Args: { p_fraccionamiento_id?: number }
        Returns: number
      }
    }
    Enums: {
      medio_acceso: "tarjeta" | "control" | "pin" | "telefono" | "qr"
      rol_usuario:
        | "super_admin"
        | "administrador"
        | "tesorero"
        | "comite"
        | "vigilancia"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      medio_acceso: ["tarjeta", "control", "pin", "telefono", "qr"],
      rol_usuario: [
        "super_admin",
        "administrador",
        "tesorero",
        "comite",
        "vigilancia",
      ],
    },
  },
} as const

