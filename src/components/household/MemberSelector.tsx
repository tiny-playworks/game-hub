import {
  Check,
  Delete,
  Lock,
  LogOut,
  ShieldAlert,
  User,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useHousehold } from '@/contexts/HouseholdContext';
import { useLocale } from '@/contexts/LocaleContext';
import { HouseholdApiError } from '@/lib/household/api';
import { formatMessage } from '@/lib/i18n';
import { getAvatarPresetById } from '@/lib/playerProfile';

type ViewMode = 'status' | 'list' | 'pin';

export function MemberSelector() {
  const { t, locale } = useLocale();
  const {
    isServerAvailable,
    mode,
    members,
    currentMember,
    login,
    logout,
    switchToGuest,
  } = useHousehold();

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<ViewMode>('list');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const selectedMember = members.find((m) => m.id === selectedMemberId);

  const resetPinState = () => {
    setPin('');
    setErrorMessage('');
    setIsSubmitting(false);
  };

  const handleOpen = () => {
    resetPinState();
    if (mode === 'member-online' && currentMember) {
      setView('status');
    } else {
      setView('list');
    }
    setOpen(true);
  };

  const handleSelectMember = (id: string) => {
    setSelectedMemberId(id);
    resetPinState();
    setView('pin');
  };

  const handleBackToList = () => {
    resetPinState();
    setView('list');
  };

  const handleDigit = (digit: string) => {
    if (pin.length < 4 && !isSubmitting) {
      const next = pin + digit;
      setPin(next);
      setErrorMessage('');
      if (next.length === 4 && selectedMemberId) {
        void submitPin(selectedMemberId, next);
      }
    }
  };

  const handleDelete = () => {
    if (pin.length > 0 && !isSubmitting) {
      setPin(pin.slice(0, -1));
      setErrorMessage('');
    }
  };

  const submitPin = async (memberId: string, pinCode: string) => {
    setIsSubmitting(true);
    try {
      await login(memberId, pinCode);
      setOpen(false);
      resetPinState();
    } catch (err) {
      if (err instanceof HouseholdApiError) {
        if (err.code === 'PIN_LOCKED' || err.status === 429) {
          setErrorMessage(t('household.error.PIN_LOCKED'));
        } else if (err.code === 'INVALID_PIN' || err.status === 401) {
          setErrorMessage(t('household.error.INVALID_PIN'));
        } else {
          setErrorMessage(t(err.messageKey));
        }
      } else {
        setErrorMessage(t('household.error.LOGIN_FAILED'));
      }
      setPin('');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 支持物理键盘数字与退格
  useEffect(() => {
    if (!open || view !== 'pin') return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        handleDelete();
      } else if (e.key === 'Escape') {
        handleBackToList();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, view, pin, selectedMemberId, isSubmitting]);

  if (!isServerAvailable) {
    return null;
  }

  const renderAvatarCircle = (presetId: string, uploadUrl: string | null) => {
    if (uploadUrl) {
      return (
        <img
          src={uploadUrl}
          alt=""
          className="size-8 rounded-full border border-slate-300 object-cover"
        />
      );
    }
    const preset = getAvatarPresetById(presetId);
    return (
      <div
        className={`flex size-8 items-center justify-center rounded-full border border-slate-300 text-sm font-semibold ${preset.bgClass} ${preset.fgClass}`}
      >
        {preset.glyph}
      </div>
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        data-member-selector-trigger
        className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
        title={
          mode === 'member-online' && currentMember
            ? `${currentMember.nickname} (${t('household.status.online')})`
            : t('household.status.guest')
        }
      >
        {mode === 'member-online' && currentMember ? (
          <>
            {renderAvatarCircle(
              currentMember.avatarPresetId,
              currentMember.avatarUploadDataUrl,
            )}
            <span className="max-w-[80px] truncate font-semibold sm:max-w-[120px]">
              {currentMember.nickname}
            </span>
            <span className="size-2 rounded-full bg-emerald-500" />
          </>
        ) : (
          <>
            <Users className="size-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">
              {t('household.button.guest')}
            </span>
          </>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          {view === 'status' && currentMember && (
            <div>
              <DialogHeader>
                <DialogTitle>{t('household.modal.currentAccount')}</DialogTitle>
                <DialogDescription>
                  {t('household.modal.currentAccountDesc')}
                </DialogDescription>
              </DialogHeader>

              <div className="mt-5 flex items-center gap-4 rounded-2xl border bg-muted/40 p-4">
                {renderAvatarCircle(
                  currentMember.avatarPresetId,
                  currentMember.avatarUploadDataUrl,
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">
                      {currentMember.nickname}
                    </h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      {t('household.status.online')}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('household.tip.cloudSynced')}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-2">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => setView('list')}
                >
                  <Users className="size-4" />
                  {t('household.button.switchMember')}
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 text-destructive hover:text-destructive"
                  onClick={async () => {
                    await logout();
                    setOpen(false);
                  }}
                >
                  <LogOut className="size-4" />
                  {t('household.button.logout')}
                </Button>
              </div>
            </div>
          )}

          {view === 'list' && (
            <div>
              <DialogHeader>
                <DialogTitle>{t('household.modal.selectMember')}</DialogTitle>
                <DialogDescription>
                  {t('household.modal.selectMemberDesc')}
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 max-h-[300px] overflow-y-auto space-y-2 pr-1">
                {members.map((member) => {
                  const isCurrent =
                    mode === 'member-online' && currentMember?.id === member.id;
                  return (
                    <button
                      key={member.id}
                      type="button"
                      data-member-id={member.id}
                      onClick={() => handleSelectMember(member.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-colors hover:bg-accent ${
                        isCurrent
                          ? 'border-primary bg-primary/5 font-semibold'
                          : 'border-border'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {renderAvatarCircle(
                          member.avatarPresetId,
                          member.avatarUploadDataUrl,
                        )}
                        <div>
                          <p className="text-sm">{member.nickname}</p>
                          {isCurrent && (
                            <p className="text-xs text-muted-foreground">
                              {t('household.status.current')}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isCurrent ? (
                          <Check className="size-4 text-primary" />
                        ) : (
                          <Lock className="size-3.5 text-muted-foreground" />
                        )}
                      </div>
                    </button>
                  );
                })}

                {members.length === 0 && (
                  <div className="text-center py-6 text-sm text-muted-foreground">
                    {t('household.empty.noMembers')}
                  </div>
                )}
              </div>

              <div className="mt-4 border-t pt-3 flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    switchToGuest();
                    setOpen(false);
                  }}
                  className="text-xs text-muted-foreground"
                >
                  <User className="size-3.5 mr-1" />
                  {t('household.button.useGuest')}
                </Button>
                <span className="text-[11px] text-muted-foreground">
                  {t('household.tip.cliManaged')}
                </span>
              </div>
            </div>
          )}

          {view === 'pin' && selectedMember && (
            <div>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Lock className="size-4" />
                  {t('household.modal.enterPin')}
                </DialogTitle>
                <DialogDescription>
                  {formatMessage(locale, 'household.modal.enterPinDesc', {
                    nickname: selectedMember.nickname,
                  })}
                </DialogDescription>
              </DialogHeader>

              <div className="mt-5 flex flex-col items-center">
                <div className="mb-2">
                  {renderAvatarCircle(
                    selectedMember.avatarPresetId,
                    selectedMember.avatarUploadDataUrl,
                  )}
                </div>
                <p className="font-semibold text-sm mb-4">
                  {selectedMember.nickname}
                </p>

                {/* 4 位 PIN 格子 */}
                <div className="flex gap-3 my-2">
                  {[0, 1, 2, 3].map((idx) => {
                    const filled = pin.length > idx;
                    return (
                      <div
                        key={idx}
                        className={`size-10 rounded-xl border flex items-center justify-center text-lg font-bold transition-all ${
                          filled
                            ? 'border-primary bg-primary/10 text-primary scale-105'
                            : 'border-muted-foreground/30 bg-muted/20'
                        }`}
                      >
                        {filled ? '●' : ''}
                      </div>
                    );
                  })}
                </div>

                {errorMessage && (
                  <div
                    role="alert"
                    className="mt-3 flex items-center gap-1.5 text-xs text-destructive font-medium"
                  >
                    <ShieldAlert className="size-3.5 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* 软键盘 */}
                <div className="grid grid-cols-3 gap-2 w-full max-w-[240px] mt-4">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                    <Button
                      key={num}
                      type="button"
                      variant="outline"
                      className="h-12 text-lg font-semibold rounded-xl"
                      disabled={isSubmitting}
                      onClick={() => handleDigit(num)}
                    >
                      {num}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-12 text-xs rounded-xl"
                    disabled={isSubmitting}
                    onClick={handleBackToList}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 text-lg font-semibold rounded-xl"
                    disabled={isSubmitting}
                    onClick={() => handleDigit('0')}
                  >
                    0
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-12 rounded-xl"
                    disabled={isSubmitting || pin.length === 0}
                    onClick={handleDelete}
                    aria-label="Delete"
                  >
                    <Delete className="size-5" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
