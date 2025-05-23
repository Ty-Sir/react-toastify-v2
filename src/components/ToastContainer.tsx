import cx from 'clsx';
import React, { Fragment, useEffect, useRef, useState } from 'react';

import { toast } from '../core';
import { useToastContainer } from '../hooks';
import { useIsomorphicLayoutEffect } from '../hooks/useIsomorphicLayoutEffect';
import { ToastContainerProps, ToastPosition } from '../types';
import { Default, Direction, isFn, parseClassName } from '../utils';
import { Toast } from './Toast';
import { Bounce } from './Transitions';

export const defaultProps: ToastContainerProps = {
  position: 'top-right',
  transition: Bounce,
  autoClose: 5000,
  closeButton: true,
  pauseOnHover: true,
  pauseOnFocusLoss: true,
  draggable: 'touch',
  draggablePercent: Default.DRAGGABLE_PERCENT as number,
  draggableDirection: Direction.X,
  role: 'alert',
  theme: 'light',
  'aria-label': 'Notifications Alt+T',
  hotKeys: e => e.altKey && e.code === 'KeyT'
};

export function ToastContainer(props: ToastContainerProps) {
  let containerProps: ToastContainerProps = {
    ...defaultProps,
    ...props
  };
  const underToastChildren = props.underToastChildren || null;
  const stacked = props.stacked;
  const [collapsed, setIsCollapsed] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const underToastChildrenRef = useRef<HTMLDivElement>(null);
  const { getToastToRender, isToastActive, count } = useToastContainer(containerProps);
  const { className, style, rtl, containerId, hotKeys } = containerProps;
  const [isToastChildrenClicked, setIsToastChildrenClicked] = useState(false);

  function getClassName(position: ToastPosition) {
    const defaultClassName = cx(
      `${Default.CSS_NAMESPACE}__toast-container`,
      `${Default.CSS_NAMESPACE}__hide-scrollbar`,
      `${Default.CSS_NAMESPACE}__toast-container--${position}`,
      { [`${Default.CSS_NAMESPACE}__toast-container--rtl`]: rtl }
    );
    return isFn(className)
      ? className({
          position,
          rtl,
          defaultClassName
        })
      : cx(defaultClassName, parseClassName(className));
  }

  function collapseAll() {
    if (stacked) {
      setIsCollapsed(true);
      toast.play();
    }
  }

  useIsomorphicLayoutEffect(() => {
    if (stacked) {
      const toastContainer = containerRef.current!.querySelectorAll('.Toastify__toast-container')?.[0] as HTMLElement;
      const nodes = containerRef.current!.querySelectorAll('[data-in="true"]');
      const underToastChildren = underToastChildrenRef?.current;
      const heightOffset = underToastChildren?.getBoundingClientRect().height || 0;

      const gap = 12;
      const isTop = containerProps.position?.includes('top');
      let usedHeight = 0;
      let prevS = 0;

      if (heightOffset && toastContainer && isTop) {
        toastContainer.style.maxHeight = `96vh`;
        toastContainer.style.overflow = `hidden auto`;
      }

      Array.from(nodes)
        .reverse()
        .forEach((n, i) => {
          const node = n as HTMLElement;
          node.classList.add(`${Default.CSS_NAMESPACE}__toast--stacked`);

          if (i > 0) node.dataset.collapsed = `${collapsed}`;

          if (!node.dataset.pos) node.dataset.pos = isTop ? 'top' : 'bot';

          let y = usedHeight * (collapsed ? 0.2 : 1) + (collapsed ? 0 : gap * i);
          if (!isTop && nodes.length > 1) {
            y += heightOffset;
          }

          node.style.setProperty('--y', `${isTop ? y : y * -1}px`);
          node.style.setProperty('--g', `${gap}`);
          node.style.setProperty('--s', `${1 - (collapsed ? prevS : 0)}`);

          usedHeight += node.offsetHeight;
          prevS += 0.025;
        });

      if (underToastChildren && isTop && collapsed) {
        const nodeOffset = usedHeight * 0.2;

        const firstNodeheight = nodes?.[0]?.getBoundingClientRect()?.height || 0;
        underToastChildren.style.marginTop = `${nodeOffset + firstNodeheight}px`;
      }

      if (underToastChildren && isTop && !collapsed) {
        const heightOfAllNodes = Array.from(nodes).reduce((acc, n) => {
          const node = n as HTMLElement;
          const nodeHeight = node.offsetHeight;
          return acc + nodeHeight + gap;
        }, 0);
        underToastChildren.style.marginTop = `${heightOfAllNodes}px`;
      }
    }
  }, [collapsed, count, stacked, props?.position]);

  useEffect(() => {
    function focusFirst(e: KeyboardEvent) {
      const node = containerRef.current;
      if (hotKeys(e)) {
        (node.querySelector('[tabIndex="0"]') as HTMLElement)?.focus();
        setIsCollapsed(false);
        toast.pause();
      }
      if (e.key === 'Escape' && (document.activeElement === node || node?.contains(document.activeElement))) {
        setIsCollapsed(true);
        toast.play();
      }
    }

    document.addEventListener('keydown', focusFirst);

    return () => {
      document.removeEventListener('keydown', focusFirst);
    };
  }, [hotKeys]);

  const handleHideToastChildren = () => {
    setIsToastChildrenClicked(true);
    setTimeout(() => {
      setIsToastChildrenClicked(false);
    }, 1000); // Reset after 1 second
  };

  return (
    <section
      ref={containerRef}
      className={Default.CSS_NAMESPACE as string}
      id={containerId as string}
      onMouseEnter={e => {
        if (underToastChildrenRef?.current && underToastChildrenRef.current.contains(e.target as Node)) {
          return;
        }
        if (stacked) {
          setIsCollapsed(false);
          toast.pause();
        }
      }}
      onMouseLeave={collapseAll}
      aria-live="polite"
      aria-atomic="false"
      aria-relevant="additions text"
      aria-label={containerProps['aria-label']}
    >
      {getToastToRender((position, toastList) => {
        const containerStyle: React.CSSProperties = !toastList.length
          ? { ...style, pointerEvents: 'none' }
          : { ...style };

        return (
          <Fragment key={`f-${position}`}>
            <div
              tabIndex={-1}
              className={getClassName(position)}
              data-stacked={stacked}
              style={containerStyle}
              key={`c-${position}`}
            >
              {toastList.map(({ content, props: toastProps }) => {
                return (
                  <Toast
                    {...toastProps}
                    stacked={stacked}
                    collapseAll={collapseAll}
                    isIn={isToastActive(toastProps.toastId, toastProps.containerId)}
                    key={`t-${toastProps.key}`}
                  >
                    {content}
                  </Toast>
                );
              })}

              <div
                onClick={handleHideToastChildren}
                ref={underToastChildrenRef}
                id="underToastChildren"
                className={`${Default.CSS_NAMESPACE}__under-toast-children`}
                style={{
                  width: '100%',
                  opacity: isToastChildrenClicked ? 0 : toastList.length > 1 ? 1 : 0,
                  transition: 'all 0.3s ease-in-out'
                }}
              >
                {underToastChildren}
              </div>
            </div>
          </Fragment>
        );
      })}
    </section>
  );
}
