import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import BanChecker from "@/components/layouts/BanChecker";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <BanChecker />
      <main>{children}</main>
      <Footer />
    </>
  );
}