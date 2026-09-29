import { redirect } from 'next/navigation';

export default function FinancePaymentsRedirectPage() {
  redirect('/bookings/payments');
}
