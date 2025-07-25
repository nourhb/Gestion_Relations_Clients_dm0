export default function Footer() {
  return (
    <footer className="py-4 md:px-6 md:py-0 border-t">
      <div className="container flex flex-col items-center justify-center gap-3 md:h-16 md:flex-row">
        <p className="text-balance text-center text-sm leading-loose text-muted-foreground">
          © {new Date().getFullYear()} DigitalMen0. جميع الحقوق محفوظة.
        </p>
      </div>
    </footer>
  );
}
