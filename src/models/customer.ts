/** Customer profile DTO (matches the `public.profiles` table). */
export interface Customer {
  id: string;
  full_name: string;
  phone: string | null;
  created_at: string;
}