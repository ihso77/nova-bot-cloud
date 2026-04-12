import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Server, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden" dir="rtl">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center"
      >
        <motion.div
          initial={{ y: -20 }}
          animate={{ y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <h1 className="text-6xl sm:text-7xl md:text-9xl font-black gradient-text mb-4">404</h1>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <p className="text-xl md:text-2xl text-muted-foreground mb-2">
            عذراً، الصفحة غير موجودة
          </p>
          <p className="text-muted-foreground mb-8">
            يبدو أنك ضللت الطريق. دعنا نعيدك إلى المكان الصحيح.
          </p>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <Link to="/">
            <Button size="lg" className="gradient-bg text-primary-foreground">
              <Home className="w-5 h-5 ml-2" />
              الصفحة الرئيسية
            </Button>
          </Link>
          <Link to="/dashboard">
            <Button size="lg" variant="outline">
              لوحة التحكم
            </Button>
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default NotFound;
