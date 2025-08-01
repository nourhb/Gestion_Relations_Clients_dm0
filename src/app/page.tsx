
import ServiceCard from '@/components/services/ServiceCard';
import { Button } from '@/components/ui/button';
import { GraduationCap, Briefcase } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <section className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-3 text-primary">مرحباً بك في DigitalMen0</h1>
        <p className="text-lg text-foreground/80 max-w-2xl mx-auto mb-6">
          نقدم خدمات استشارية وتدريبية مخصصة لمساعدتك في تحقيق أهدافك الرقمية والمهنية.
        </p>
        <Button size="default" asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <Link href="/request">اطلب خدمتك الآن</Link>
        </Button>
      </section>

      <section className="mb-12">
        <Image
          src="/Digital Marketing Agency.png"
          alt="Digital Marketing Agency Services"
          width={800}
          height={300}
          className="rounded-lg shadow-lg object-cover w-full"
          data-ai-hint="digital marketing agency"
          priority // Added priority for LCP image
        />
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-center mb-8 text-foreground">خدماتنا</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <ServiceCard
            title="التدريب الشخصي (Coaching)"
            description="برامج تدريبية فردية مصممة لتطوير مهاراتك وتحقيق إمكاناتك الكاملة في المجال الرقمي."
            icon={<GraduationCap className="h-8 w-8 text-accent" />}
            imageSrc="/3.png"
            imageAlt="Coaching Service Illustration"
            dataAiHint="coaching mentorship"
            serviceKey="coaching" // Added serviceKey
          />
          <ServiceCard
            title="الاستشارات (Consultation)"
            description="استشارات متخصصة لمساعدتك في التغلب على التحديات، اتخاذ قرارات استراتيجية، وتحسين أداء أعمالك الرقمية."
            icon={<Briefcase className="h-8 w-8 text-accent" />}
            imageSrc="/2.png"
            imageAlt="Consultation Service Illustration"
            dataAiHint="business consultation"
            serviceKey="consultation" // Added serviceKey
          />
        </div>
      </section>
    </div>
  );
}
