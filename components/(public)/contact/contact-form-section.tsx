'use client';

import { Button, Card, CardBody } from '@heroui/react';
import { motion, useReducedMotion } from 'framer-motion';
import { Send } from 'lucide-react';
import { useContactForm } from '@/lib/hooks/use-contact-form';
import { ContactInfoCard } from './_components/contact-info-card';
import { ContactFormFields } from './_components/contact-form-fields';
import { ContactFormStatus } from './_components/contact-form-status';

function ContactFormSection() {
  const reduceMotion = useReducedMotion();
  const { values, errors, isSubmitting, status, setField, submit } =
    useContactForm();

  const containerProps = reduceMotion
    ? {}
    : ({
        initial: 'hidden' as const,
        whileInView: 'visible' as const,
        viewport: { once: true, amount: 0.25 },
        variants: {
          hidden: {},
          visible: { transition: { staggerChildren: 0.07 } },
        },
      } as const);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submit();
  }

  return (
    <section
      aria-labelledby="contact-form-title"
      className="relative overflow-hidden bg-[linear-gradient(180deg,rgba(255,252,248,1)_0%,rgba(248,242,235,1)_100%)] py-16 md:py-24"
    >
      <div
        className="pointer-events-none absolute -top-16 right-0 h-56 w-56 rounded-full bg-primary/12 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-16 left-0 h-64 w-64 rounded-full bg-secondary/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="content-container relative px-6">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10">
          <ContactInfoCard />

          <motion.div
            initial={reduceMotion ? undefined : { opacity: 0, y: 18 }}
            whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={
              reduceMotion
                ? undefined
                : { duration: 0.65, ease: 'easeOut', delay: 0.08 }
            }
          >
            <Card className="rounded-3xl border border-default-200/70 bg-background/90 shadow-xl shadow-black/10 backdrop-blur-sm">
              <CardBody className="p-5 sm:p-7">
                <motion.form
                  onSubmit={handleSubmit}
                  className="space-y-4"
                  {...containerProps}
                >
                  <ContactFormFields
                    values={values}
                    errors={errors}
                    setField={setField}
                  />

                  <ContactFormStatus
                    status={status}
                    submitError={errors.submit}
                  />

                  <div className="pt-2">
                    <Button
                      type="submit"
                      color="primary"
                      radius="full"
                      size="lg"
                      className="w-full px-8 sm:w-auto"
                      isLoading={isSubmitting}
                      isDisabled={isSubmitting}
                      endContent={
                        <Send aria-hidden="true" className="h-4 w-4" />
                      }
                    >
                      Envoyer le message
                    </Button>
                  </div>
                </motion.form>
              </CardBody>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export default ContactFormSection;
