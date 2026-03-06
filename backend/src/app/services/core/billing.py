import stripe
import os
import logging
from app.core import database as db

logger = logging.getLogger(__name__)

# Initialize Stripe
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET")

def create_checkout_session(user_id: str, email: str, domain_url: str):
    """Create a Stripe checkout session."""
    try:
        logger.info(f"💰 Criando sessão de checkout para o usuário {user_id}")
        
        session = stripe.checkout.Session.create(
            client_reference_id=user_id,
            customer_email=email,
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'brl',
                    'product_data': {
                        'name': 'Assinatura Premium',
                        'description': 'Acesso completo às análises de IA e execuções recorrentes.',
                    },
                    'unit_amount': 9700, # R$ 97,00
                    'recurring': {
                        'interval': 'month'
                    }
                },
                'quantity': 1,
            }],
            mode='subscription',
            success_url=f'{domain_url}/billing/success?session_id={{CHECKOUT_SESSION_ID}}',
            cancel_url=f'{domain_url}/billing/cancel',
        )
        return {"success": True, "checkout_url": session.url}
    except Exception as e:
        logger.error(f"Erro no Stripe: {str(e)}")
        return {"success": False, "error": str(e)}

def handle_webhook_event(payload, sig_header):
    """Process incoming Stripe webhook events."""
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
    except ValueError as e:
        # Invalid payload
        return {"success": False, "error": "Invalid payload"}
    except stripe.error.SignatureVerificationError as e:
        # Invalid signature
        return {"success": False, "error": "Invalid signature"}

    # Handle the event
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        update_user_subscription(session)
    elif event['type'] == 'invoice.payment_succeeded':
        # Optional: update next billing date, etc.
        pass
    elif event['type'] == 'customer.subscription.deleted':
        subscription = event['data']['object']
        cancel_user_subscription(subscription)

    return {"success": True}

def update_user_subscription(session):
    """Update user status to premium upon successful checkout payment."""
    user_id = session.get('client_reference_id')
    customer_id = session.get('customer')
    if user_id:
        try:
            conn = db.get_connection()
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE users SET subscription_status = 'premium', stripe_customer_id = %s WHERE id = %s",
                (customer_id, user_id)
            )
            conn.commit()
            conn.close()
            logger.info(f"✅ Assinatura premium ativada para o usuário {user_id}")
        except Exception as e:
            logger.error(f"Falha ao atualizar assinatura (checkout.session.completed): {e}")

def cancel_user_subscription(subscription):
    """Downgrade user status to free when subscription is deleted/cancelled."""
    customer_id = subscription.get('customer')
    if customer_id:
        try:
            conn = db.get_connection()
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE users SET subscription_status = 'free' WHERE stripe_customer_id = %s",
                (customer_id,)
            )
            conn.commit()
            conn.close()
            logger.info(f"📉 Assinatura cancelada para o cliente Stripe {customer_id}")
        except Exception as e:
            logger.error(f"Falha ao cancelar assinatura (customer.subscription.deleted): {e}")
