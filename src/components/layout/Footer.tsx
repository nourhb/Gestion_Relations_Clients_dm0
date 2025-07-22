export default function Footer() {
  return (
    <footer className="py-6 md:px-8 md:py-0 border-t">
      <div className="container flex flex-col items-center justify-center gap-4 md:h-24 md:flex-row">
        <p className="text-balance text-center text-sm leading-loose text-muted-foreground">
          © {new Date().getFullYear()} DigitalMen0. جميع الحقوق محفوظة.
        </p>
      </div>
    </footer>
  );
}
