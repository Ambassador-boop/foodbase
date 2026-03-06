import PopularDishForm from '@/components/popular-dish-form';

export const metadata = {
  title: 'Add Featured Dish',
  description: 'Add a featured or popular dish combination',
};

export default function NewPopularDishPage() {
  return (
    <div className="py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Add Featured Dish</h1>
        <p className="text-muted-foreground text-sm mt-1">Create a new featured combination or popular dish</p>
      </div>
      <PopularDishForm />
    </div>
  );
}
