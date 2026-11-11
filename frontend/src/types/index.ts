export interface User {id: number; username: string; name: string}
export type Status = 'PROPOSED' | 'SCHEDULED' | 'COMPLETED'
export interface Topic {
  id: number; title: string; description: string; kind: 'OFFER' | 'REQUEST'; status: Status;
  duration_minutes: number; proposer: User; presenter: User | null; scheduled_at: string | null;
  meeting_link: string | null; slides_url: string | null; vote_count: number; has_voted: boolean;
  created_at: string; updated_at: string;
}
export interface Identity {token: string; user: User}
